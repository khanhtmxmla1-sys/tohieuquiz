import type {
    ResultDashboardSummary,
    ResultScoreBucket,
    ResultScoreRange,
    ResultSummaryStatistics,
} from '../../../shared/result-summary.contract';
import { withD1Retry } from '../utils/d1';

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SCORE_RANGES: Array<{
    range: ResultScoreRange;
    includes: (score: number) => boolean;
}> = [
    { range: '0-2', includes: (score) => score >= 0 && score < 3 },
    { range: '3-4', includes: (score) => score >= 3 && score < 5 },
    { range: '5-6', includes: (score) => score >= 5 && score < 7 },
    { range: '7-8', includes: (score) => score >= 7 && score < 9 },
    { range: '9-10', includes: (score) => score >= 9 && score <= 10 },
];

export type ResultSummaryScope =
    | { role: 'admin' }
    | { role: 'teacher'; username: string };

interface ActivitySummaryRow {
    total_submissions: number | string | null;
    unique_completed_works: number | string | null;
    today_submissions: number | string | null;
    unique_students: number | string | null;
}

interface ScoreRow {
    score: number | string | null;
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const toCount = (value: number | string | null | undefined): number => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
};

const emptyBuckets = (): ResultScoreBucket[] => SCORE_RANGES.map(({ range }) => ({
    range,
    count: 0,
    percentage: 0,
}));

export function calculateResultSummaryStatistics(rawScores: number[]): ResultSummaryStatistics {
    const scores = rawScores
        .map(Number)
        .filter((score) => Number.isFinite(score) && score >= 0 && score <= 10)
        .sort((left, right) => left - right);

    if (scores.length === 0) {
        return {
            totalResults: 0,
            mean: 0,
            median: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            passRate: 0,
            passCount: 0,
            failCount: 0,
            scoreDistribution: emptyBuckets(),
        };
    }

    const total = scores.length;
    const sum = scores.reduce((current, score) => current + score, 0);
    const mean = sum / total;
    const middle = Math.floor(total / 2);
    const median = total % 2 === 0
        ? (scores[middle - 1] + scores[middle]) / 2
        : scores[middle];
    const variance = scores.reduce((current, score) => (
        current + ((score - mean) ** 2)
    ), 0) / total;
    const passCount = scores.filter((score) => score >= 5).length;
    const failCount = total - passCount;
    const scoreDistribution = SCORE_RANGES.map(({ range, includes }) => {
        const count = scores.filter(includes).length;
        return {
            range,
            count,
            percentage: roundToTwo((count / total) * 100),
        };
    });

    return {
        totalResults: total,
        mean: roundToTwo(mean),
        median: roundToTwo(median),
        stdDev: roundToTwo(Math.sqrt(variance)),
        min: roundToTwo(scores[0]),
        max: roundToTwo(scores[scores.length - 1]),
        passRate: Math.round((passCount / total) * 100),
        passCount,
        failCount,
        scoreDistribution,
    };
}

export function getIctDayBounds(now = new Date()): { start: string; end: string } {
    const shifted = new Date(now.getTime() + ICT_OFFSET_MS);
    const startUtcMs = Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
    ) - ICT_OFFSET_MS;

    return {
        start: new Date(startUtcMs).toISOString(),
        end: new Date(startUtcMs + DAY_MS).toISOString(),
    };
}

const buildScopedCte = (scope: ResultSummaryScope): { sql: string; bindings: unknown[] } => {
    const whereClause = scope.role === 'teacher'
        ? ' WHERE class_name IN (SELECT name FROM classes WHERE teacher_username = ?)'
        : '';
    const bindings = scope.role === 'teacher' ? [scope.username] : [];

    return {
        sql: `
            WITH scoped AS (
                SELECT
                    id,
                    student_id,
                    assignment_id,
                    student_name,
                    class_name,
                    quiz_id,
                    score,
                    submitted_at
                FROM results${whereClause}
            ),
            keyed AS (
                SELECT
                    *,
                    CASE
                        WHEN TRIM(COALESCE(student_id, '')) <> ''
                            THEN 'id:' || TRIM(student_id)
                        ELSE 'legacy:' || LOWER(TRIM(student_name)) || '|' || LOWER(TRIM(class_name))
                    END AS student_key,
                    CASE
                        WHEN TRIM(COALESCE(assignment_id, '')) <> ''
                            THEN 'assignment:' || TRIM(assignment_id)
                        WHEN TRIM(COALESCE(quiz_id, '')) <> ''
                            THEN 'quiz:' || TRIM(quiz_id)
                        ELSE 'result:' || CAST(id AS TEXT)
                    END AS work_key
                FROM scoped
            )
        `,
        bindings,
    };
};

export async function loadResultDashboardSummary(
    db: D1Database,
    scope: ResultSummaryScope,
    now = new Date(),
): Promise<ResultDashboardSummary> {
    const scoped = buildScopedCte(scope);
    const dayBounds = getIctDayBounds(now);

    const activitySql = `${scoped.sql}
        SELECT
            COUNT(*) AS total_submissions,
            COUNT(DISTINCT student_key || CHAR(31) || work_key) AS unique_completed_works,
            SUM(CASE WHEN submitted_at >= ? AND submitted_at < ? THEN 1 ELSE 0 END) AS today_submissions,
            COUNT(DISTINCT student_key) AS unique_students
        FROM keyed
    `;
    const activity = await withD1Retry(
        () => db.prepare(activitySql)
            .bind(...scoped.bindings, dayBounds.start, dayBounds.end)
            .first<ActivitySummaryRow>(),
        'GET /api/results/summary activity',
    );

    const latestScoresSql = `${scoped.sql},
        ranked AS (
            SELECT
                score,
                student_key,
                work_key,
                ROW_NUMBER() OVER (
                    PARTITION BY student_key, work_key
                    ORDER BY submitted_at DESC, id DESC
                ) AS attempt_rank
            FROM keyed
        )
        SELECT score
        FROM ranked
        WHERE attempt_rank = 1
        ORDER BY score ASC
    `;
    const scoreRows = await withD1Retry(
        () => db.prepare(latestScoresSql)
            .bind(...scoped.bindings)
            .all<ScoreRow>(),
        'GET /api/results/summary latest scores',
    );
    const scores = (scoreRows.results || []).map((row) => Number(row.score));

    return {
        totalSubmissions: toCount(activity?.total_submissions),
        uniqueCompletedWorks: toCount(activity?.unique_completed_works),
        todaySubmissions: toCount(activity?.today_submissions),
        uniqueStudents: toCount(activity?.unique_students),
        statistics: calculateResultSummaryStatistics(scores),
        attemptPolicy: 'latest',
        timezone: 'Asia/Ho_Chi_Minh',
    };
}
