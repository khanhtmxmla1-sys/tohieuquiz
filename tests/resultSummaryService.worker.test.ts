import { describe, expect, it } from 'vitest';
import {
    calculateResultSummaryStatistics,
    getIctDayBounds,
    loadResultDashboardSummary,
} from '../workers/src/services/resultSummaryService';

class FakeStatement {
    private bindings: unknown[] = [];

    constructor(
        private readonly db: FakeDatabase,
        private readonly sql: string,
    ) {}

    bind(...values: unknown[]) {
        this.bindings = values;
        return this;
    }

    async first<T>() {
        this.db.calls.push({ kind: 'first', sql: this.sql, bindings: this.bindings });
        return this.db.activityRow as T;
    }

    async all<T>() {
        this.db.calls.push({ kind: 'all', sql: this.sql, bindings: this.bindings });
        return { results: this.db.scoreRows } as unknown as D1Result<T>;
    }
}

class FakeDatabase {
    calls: Array<{ kind: 'first' | 'all'; sql: string; bindings: unknown[] }> = [];

    constructor(
        readonly activityRow = {
            total_submissions: 5,
            unique_completed_works: 3,
            today_submissions: 2,
            unique_students: 2,
        },
        readonly scoreRows: Array<{ score: number }> = [
            { score: 4.5 },
            { score: 6.5 },
            { score: 8.5 },
        ],
    ) {}

    prepare(sql: string) {
        return new FakeStatement(this, sql);
    }
}

describe('calculateResultSummaryStatistics', () => {
    it('uses mathematically correct decimal score buckets', () => {
        const summary = calculateResultSummaryStatistics([2.5, 4.5, 6.5, 8.5, 10]);

        expect(summary.scoreDistribution.map((item) => item.count)).toEqual([1, 1, 1, 1, 1]);
        expect(summary.passCount).toBe(3);
        expect(summary.failCount).toBe(2);
        expect(summary.passRate).toBe(60);
        expect(summary.mean).toBe(6.4);
        expect(summary.median).toBe(6.5);
        expect(summary.min).toBe(2.5);
        expect(summary.max).toBe(10);
    });

    it('returns a stable five-bucket zero summary for an empty cohort', () => {
        const summary = calculateResultSummaryStatistics([]);

        expect(summary).toMatchObject({
            totalResults: 0,
            mean: 0,
            median: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            passRate: 0,
            passCount: 0,
            failCount: 0,
        });
        expect(summary.scoreDistribution).toEqual([
            { range: '0-2', count: 0, percentage: 0 },
            { range: '3-4', count: 0, percentage: 0 },
            { range: '5-6', count: 0, percentage: 0 },
            { range: '7-8', count: 0, percentage: 0 },
            { range: '9-10', count: 0, percentage: 0 },
        ]);
    });

    it('ignores invalid scores instead of corrupting learning statistics', () => {
        const summary = calculateResultSummaryStatistics([Number.NaN, -1, 5, 11, 7]);
        expect(summary.totalResults).toBe(2);
        expect(summary.mean).toBe(6);
        expect(summary.passRate).toBe(100);
    });
});

describe('getIctDayBounds', () => {
    it('returns UTC bounds for the current Vietnam calendar day', () => {
        expect(getIctDayBounds(new Date('2026-07-24T16:30:00.000Z'))).toEqual({
            start: '2026-07-23T17:00:00.000Z',
            end: '2026-07-24T17:00:00.000Z',
        });
    });
});

describe('loadResultDashboardSummary', () => {
    it('loads an all-school admin summary without a teacher binding', async () => {
        const db = new FakeDatabase();
        const summary = await loadResultDashboardSummary(
            db as unknown as D1Database,
            { role: 'admin' },
            new Date('2026-07-24T08:00:00.000Z'),
        );

        expect(summary).toMatchObject({
            totalSubmissions: 5,
            uniqueCompletedWorks: 3,
            todaySubmissions: 2,
            uniqueStudents: 2,
            attemptPolicy: 'latest',
            timezone: 'Asia/Ho_Chi_Minh',
            statistics: {
                totalResults: 3,
                mean: 6.5,
                passCount: 2,
            },
        });
        expect(db.calls).toHaveLength(2);
        expect(db.calls[0].bindings).toEqual([
            '2026-07-23T17:00:00.000Z',
            '2026-07-24T17:00:00.000Z',
        ]);
        expect(db.calls[1].bindings).toEqual([]);
        expect(db.calls.every((call) => !call.sql.includes('teacher_username = ?'))).toBe(true);
    });

    it('scopes both teacher queries by the authenticated username', async () => {
        const db = new FakeDatabase();
        await loadResultDashboardSummary(
            db as unknown as D1Database,
            { role: 'teacher', username: 'teacher-a' },
            new Date('2026-07-24T08:00:00.000Z'),
        );

        expect(db.calls).toHaveLength(2);
        expect(db.calls[0].bindings).toEqual([
            'teacher-a',
            '2026-07-23T17:00:00.000Z',
            '2026-07-24T17:00:00.000Z',
        ]);
        expect(db.calls[1].bindings).toEqual(['teacher-a']);
        expect(db.calls.every((call) => call.sql.includes('teacher_username = ?'))).toBe(true);
        expect(db.calls[1].sql).toContain('ROW_NUMBER() OVER');
        expect(db.calls[1].sql).toContain('PARTITION BY student_key, work_key');
    });
});
