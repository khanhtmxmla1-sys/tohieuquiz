import type { D1Database } from '@cloudflare/workers-types';
import type { CreateAssignmentPayload } from '../../../src/types/classroom.types';
import {
    buildWeaknessProfileFromData,
    getQuestionsForQuizIds,
    getRecentResultsForStudentContext,
    getResultById,
    parseStoredAnswers,
    type ResultRowWithAnswers,
} from './weaknessProfile';
import {
    getSkillLabel,
    getSubjectLabel,
    normalizeSkillCode,
    resolveExplicitSkillMetadata,
    resolveSkillMetadataFromTags,
    splitSkillTags,
    type SkillBreakdownItem,
    type SupportedSkillSubject,
} from '../../../src/shared/skillTaxonomy';

type SmartAssignmentPreviewErrorCode =
    | 'STUDENT_NOT_FOUND'
    | 'AMBIGUOUS_STUDENT_MATCH'
    | 'NO_RECOMMENDED_QUIZ';

interface SmartAssignmentPreviewRequest {
    resultId?: string;
    teacherUsername?: string;
    strategy?: 'top_weak_skill';
    preferredQuizId?: string;
    deadlinePreset?: '3d' | '7d' | '14d' | 'custom';
    maxAttempts?: number;
}

interface SmartAssignmentPreviewCandidate {
    id: string;
    fullName: string;
    classId: string;
    className: string;
}

interface SmartAssignmentRecommendedQuiz {
    quizId: string;
    title: string;
    matchReason: string;
    questionCount: number;
    timeLimit: number;
    confidence: number;
    matchBreakdown: {
        subjectMatched: boolean;
        skillMatched: boolean;
        subskillMatched: boolean;
        matchedViaTags: boolean;
        avgDifficulty?: number;
        targetDifficulty: 1 | 2 | 3;
        difficultyDistance?: number;
        totalScore: number;
    };
}

interface SmartAssignmentPreviewData {
    student: SmartAssignmentPreviewCandidate;
    weaknessSummary: {
        resultId: string;
        coveragePercent: number;
        basedOnResultIds: string[];
        topSkill: {
            subject: SupportedSkillSubject;
            subjectLabel: string;
            skillCode: string;
            skillLabel: string;
            subskillCode?: string;
            subskillLabel?: string;
            status: SkillBreakdownItem['status'];
            accuracy: number;
            attempted: number;
            wrong: number;
            targetDifficulty: 1 | 2 | 3;
        };
    };
    recommendedQuizzes: SmartAssignmentRecommendedQuiz[];
    assignmentDraft: CreateAssignmentPayload;
    warnings: Array<{ code: string; message: string }>;
}

type SmartAssignmentPreviewResponse =
    | {
        status: 'success';
        data: SmartAssignmentPreviewData;
    }
    | {
        status: 'error';
        code: SmartAssignmentPreviewErrorCode;
        message: string;
        data?: {
            candidates?: SmartAssignmentPreviewCandidate[];
        };
    };

interface QuizQuestionRow {
    quiz_id: string;
    title: string;
    time_limit: number;
    question_count: number;
    subject?: string;
    skill_code?: string;
    subskill_code?: string;
    tags?: string;
    difficulty?: number | string;
    difficulty_level?: number | string;
    difficultyLevel?: number | string;
}

function normalizeClassName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/^lop\s+/i, '')
        .replace(/^l[ớo]p\s+/i, '')
        .replace(/\s+/g, '');
}

function getDeadlineFromPreset(
    deadlinePreset: SmartAssignmentPreviewRequest['deadlinePreset'],
): string {
    const base = new Date();
    const daysToAdd = deadlinePreset === '3d'
        ? 3
        : deadlinePreset === '14d'
            ? 14
            : 7;

    base.setDate(base.getDate() + daysToAdd);
    base.setHours(23, 59, 0, 0);
    return base.toISOString();
}

function humanizeSkillCode(value?: string): string | undefined {
    const normalized = normalizeSkillCode(value);
    if (!normalized) return undefined;
    return normalized
        .split('_')
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
}

function getTargetDifficulty(topSkill: SkillBreakdownItem): 1 | 2 | 3 {
    if (topSkill.status === 'weak' && topSkill.accuracy < 40) return 1;
    if (topSkill.status === 'weak' && topSkill.accuracy < 60) return 2;
    if (topSkill.status === 'needs_practice' && topSkill.accuracy >= 60) return 2;
    return 2;
}

function resolveQuestionDifficulty(question: QuizQuestionRow): 1 | 2 | 3 | undefined {
    const rawDifficulty = question.difficulty ?? question.difficulty_level ?? question.difficultyLevel;
    const numericDifficulty = Number(rawDifficulty);
    if (numericDifficulty === 1 || numericDifficulty === 2 || numericDifficulty === 3) {
        return numericDifficulty as 1 | 2 | 3;
    }

    const tags = splitSkillTags(question.tags);
    if (tags.some((tag) => ['difficulty_1', 'muc_1', 'muc_do_1', 'level_1', 'easy', 'de'].includes(tag))) return 1;
    if (tags.some((tag) => ['difficulty_2', 'muc_2', 'muc_do_2', 'level_2', 'medium', 'trung_binh'].includes(tag))) return 2;
    if (tags.some((tag) => ['difficulty_3', 'muc_3', 'muc_do_3', 'level_3', 'hard', 'kho'].includes(tag))) return 3;

    return undefined;
}

function pickTopWeakSkill(skills: SkillBreakdownItem[]): SkillBreakdownItem | null {
    const statusWeight: Record<SkillBreakdownItem['status'], number> = {
        weak: 0,
        needs_practice: 1,
        stable: 2,
    };

    return [...skills]
        .sort((left, right) => {
            if (statusWeight[left.status] !== statusWeight[right.status]) {
                return statusWeight[left.status] - statusWeight[right.status];
            }
            if (left.accuracy !== right.accuracy) {
                return left.accuracy - right.accuracy;
            }
            return right.wrong - left.wrong;
        })[0] || null;
}

function resolveAnswerSkillMetadata(dbQuestion: any, answerData: any) {
    const snapshot = answerData && typeof answerData === 'object' ? answerData.questionSnapshot : null;

    return resolveExplicitSkillMetadata(
        {
            subject: dbQuestion?.subject,
            skillCode: dbQuestion?.skill_code,
            subskillCode: dbQuestion?.subskill_code,
        },
        'explicit_db',
    ) || resolveExplicitSkillMetadata(
        {
            subject: snapshot?.subject,
            skillCode: snapshot?.skillCode,
            subskillCode: snapshot?.subskillCode,
        },
        'explicit_question',
    ) || resolveSkillMetadataFromTags(dbQuestion?.tags) || resolveSkillMetadataFromTags(snapshot?.tags);
}

function pickTopSubskillForSkill(
    recentResults: ResultRowWithAnswers[],
    questions: Array<{ id: string; subject?: string; skill_code?: string; subskill_code?: string; tags?: string }>,
    topSkill: SkillBreakdownItem,
): { subskillCode?: string; subskillLabel?: string } {
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const subskillBuckets = new Map<string, { wrong: number; attempted: number }>();

    for (const result of recentResults) {
        const answers = parseStoredAnswers(result.answers);

        for (const [questionId, answerData] of Object.entries(answers)) {
            if (questionId.startsWith('_')) continue;

            const metadata = resolveAnswerSkillMetadata(questionsById.get(questionId), answerData);
            if (!metadata) continue;
            if (metadata.subject !== topSkill.subject || normalizeSkillCode(metadata.skillCode) !== normalizeSkillCode(topSkill.skillCode)) {
                continue;
            }
            if (!metadata.subskillCode) continue;

            const selectedAnswer = answerData && typeof answerData === 'object' && 'selectedAnswer' in answerData
                ? answerData.selectedAnswer
                : answerData;
            const persistedCorrectness = answerData && typeof answerData === 'object' && typeof answerData.isCorrect === 'boolean'
                ? answerData.isCorrect
                : null;

            if (
                selectedAnswer === undefined ||
                selectedAnswer === null ||
                selectedAnswer === '' ||
                (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)
            ) {
                continue;
            }

            const bucket = subskillBuckets.get(metadata.subskillCode) || { wrong: 0, attempted: 0 };
            bucket.attempted += 1;
            if (persistedCorrectness === false) {
                bucket.wrong += 1;
            }
            subskillBuckets.set(metadata.subskillCode, bucket);
        }
    }

    const bestMatch = Array.from(subskillBuckets.entries())
        .sort((left, right) => {
            if (left[1].wrong !== right[1].wrong) return right[1].wrong - left[1].wrong;
            if (left[1].attempted !== right[1].attempted) return right[1].attempted - left[1].attempted;
            return left[0].localeCompare(right[0]);
        })[0];

    if (!bestMatch) {
        return {};
    }

    return {
        subskillCode: bestMatch[0],
        subskillLabel: humanizeSkillCode(bestMatch[0]),
    };
}

async function resolveStudentFromResult(
    db: D1Database,
    result: ResultRowWithAnswers,
    teacherUsername: string,
): Promise<
    | { type: 'success'; student: SmartAssignmentPreviewCandidate }
    | { type: 'error'; code: 'STUDENT_NOT_FOUND'; message: string }
    | { type: 'error'; code: 'AMBIGUOUS_STUDENT_MATCH'; message: string; candidates: SmartAssignmentPreviewCandidate[] }
> {
    const studentRows = await db.prepare(
        `SELECT s.id, s.full_name, s.class_id, c.name AS class_name
         FROM students s
         INNER JOIN classes c ON c.id = s.class_id
         WHERE s.full_name = ? AND c.teacher_username = ?`,
    ).bind(result.student_name, teacherUsername).all<{
        id: string;
        full_name: string;
        class_id: string;
        class_name: string;
    }>();

    const normalizedResultClass = normalizeClassName(result.class_name || '');
    const candidates = (studentRows.results || [])
        .filter((row) => normalizeClassName(row.class_name || '') === normalizedResultClass)
        .map((row) => ({
            id: row.id,
            fullName: row.full_name,
            classId: row.class_id,
            className: row.class_name,
        }));

    if (candidates.length === 0) {
        return {
            type: 'error',
            code: 'STUDENT_NOT_FOUND',
            message: 'Khong tim thay hoc sinh tu result hien tai.',
        };
    }

    if (candidates.length > 1) {
        return {
            type: 'error',
            code: 'AMBIGUOUS_STUDENT_MATCH',
            message: 'Co nhieu hoc sinh trung ten trong cung ngu canh lop.',
            candidates,
        };
    }

    return { type: 'success', student: candidates[0] };
}

function resolveQuestionSkill(question: QuizQuestionRow) {
    return resolveExplicitSkillMetadata(
        {
            subject: question.subject,
            skillCode: question.skill_code,
            subskillCode: question.subskill_code,
        },
        'explicit_db',
    ) || resolveSkillMetadataFromTags(question.tags);
}

async function findRecommendedQuizzes(
    db: D1Database,
    options: {
        preferredQuizId?: string;
        currentQuizId: string;
        subject: SupportedSkillSubject;
        skillCode: string;
        subskillCode?: string;
        targetDifficulty: 1 | 2 | 3;
    },
): Promise<SmartAssignmentRecommendedQuiz[]> {
    const rows = await db.prepare(
        `SELECT
            q.id AS quiz_id,
            q.title,
            q.time_limit,
            qt.subject,
            qt.skill_code,
            qt.subskill_code,
            qt.tags,
            qt.difficulty
         FROM quizzes q
         INNER JOIN questions qt ON qt.quiz_id = q.id
         WHERE q.id <> ?`,
    ).bind(options.currentQuizId).all<QuizQuestionRow>();

    const grouped = new Map<string, {
        quizId: string;
        title: string;
        timeLimit: number;
        questionCount: number;
        subjectMatchCount: number;
        skillMatchCount: number;
        subskillMatchCount: number;
        tagMatchCount: number;
        difficultySum: number;
        difficultyCount: number;
        metadataMatchedCount: number;
    }>();

    for (const row of rows.results || []) {
        const resolvedSkill = resolveQuestionSkill(row);
        const resolvedDifficulty = resolveQuestionDifficulty(row);
        const existing = grouped.get(row.quiz_id) || {
            quizId: row.quiz_id,
            title: row.title,
            timeLimit: Number(row.time_limit) || 0,
            questionCount: 0,
            subjectMatchCount: 0,
            skillMatchCount: 0,
            subskillMatchCount: 0,
            tagMatchCount: 0,
            difficultySum: 0,
            difficultyCount: 0,
            metadataMatchedCount: 0,
        };

        existing.questionCount += 1;

        if (resolvedDifficulty) {
            existing.difficultySum += resolvedDifficulty;
            existing.difficultyCount += 1;
        }

        if (resolvedSkill) {
            existing.metadataMatchedCount += 1;
        }

        if (resolvedSkill?.subject === options.subject) {
            existing.subjectMatchCount += 1;
        }

        if (resolvedSkill?.subject === options.subject && resolvedSkill.skillCode === options.skillCode) {
            if (options.subskillCode && resolvedSkill.subskillCode === options.subskillCode) {
                existing.subskillMatchCount += 1;
            }
            if (resolvedSkill.source === 'tags') {
                existing.tagMatchCount += 1;
            } else {
                existing.skillMatchCount += 1;
            }
        }

        grouped.set(row.quiz_id, existing);
    }

    const toConfidence = (totalScore: number) => {
        if (totalScore >= 90) return 0.95;
        if (totalScore >= 70) return 0.88;
        if (totalScore >= 50) return 0.78;
        return 0.65;
    };

    const recommendations = Array.from(grouped.values())
        .filter((quiz) => quiz.subskillMatchCount > 0 || quiz.skillMatchCount > 0 || quiz.tagMatchCount > 0)
        .map((quiz) => {
            const avgDifficulty = quiz.difficultyCount > 0
                ? Math.round(quiz.difficultySum / quiz.difficultyCount)
                : undefined;
            const difficultyDistance = avgDifficulty === undefined
                ? undefined
                : Math.abs(avgDifficulty - options.targetDifficulty);
            const metadataCoveragePercent = quiz.questionCount === 0
                ? 0
                : Math.round((quiz.metadataMatchedCount / quiz.questionCount) * 100);

            let totalScore = 0;
            totalScore += quiz.subskillMatchCount > 0 ? 50 : 0;
            totalScore += quiz.skillMatchCount > 0 ? 30 : 0;
            totalScore += quiz.subjectMatchCount > 0 ? 10 : 0;
            totalScore += quiz.tagMatchCount > 0 ? 8 : 0;

            if (difficultyDistance === 0) totalScore += 12;
            else if (difficultyDistance === 1) totalScore += 6;
            else if (typeof difficultyDistance === 'number' && difficultyDistance >= 2) totalScore -= 8;

            if (metadataCoveragePercent >= 80) totalScore += 4;
            else if (metadataCoveragePercent >= 50) totalScore += 2;

            if (quiz.timeLimit > 20) totalScore -= 6;
            if (quiz.questionCount > 20) totalScore -= 4;

            const skillLabel = humanizeSkillCode(options.skillCode) || options.skillCode;
            const subskillLabel = humanizeSkillCode(options.subskillCode) || options.subskillCode;
            const matchReason = quiz.subskillMatchCount > 0 && subskillLabel
                ? `Khop sat subskill ${subskillLabel}`
                : quiz.skillMatchCount > 0
                    ? `Khop skill ${skillLabel}`
                    : `Khop tags cua skill ${skillLabel}`;

            return {
                subskillMatchCount: quiz.subskillMatchCount,
                skillMatchCount: quiz.skillMatchCount,
                difficultyDistance: difficultyDistance ?? Number.MAX_SAFE_INTEGER,
                questionCount: quiz.questionCount,
                timeLimit: quiz.timeLimit,
                recommendedQuiz: {
                quizId: quiz.quizId,
                title: quiz.title,
                questionCount: quiz.questionCount,
                timeLimit: quiz.timeLimit,
                matchReason,
                confidence: toConfidence(totalScore),
                matchBreakdown: {
                    subjectMatched: quiz.subjectMatchCount > 0,
                    skillMatched: quiz.skillMatchCount > 0,
                    subskillMatched: quiz.subskillMatchCount > 0,
                    matchedViaTags: quiz.tagMatchCount > 0 && quiz.skillMatchCount === 0 && quiz.subskillMatchCount === 0,
                    avgDifficulty,
                    targetDifficulty: options.targetDifficulty,
                    difficultyDistance,
                    totalScore,
                },
                },
            };
        })
        .sort((left, right) => {
            if (left.recommendedQuiz.matchBreakdown.totalScore !== right.recommendedQuiz.matchBreakdown.totalScore) {
                return right.recommendedQuiz.matchBreakdown.totalScore - left.recommendedQuiz.matchBreakdown.totalScore;
            }
            if (left.subskillMatchCount !== right.subskillMatchCount) {
                return right.subskillMatchCount - left.subskillMatchCount;
            }
            if (left.skillMatchCount !== right.skillMatchCount) {
                return right.skillMatchCount - left.skillMatchCount;
            }
            if (left.difficultyDistance !== right.difficultyDistance) {
                return left.difficultyDistance - right.difficultyDistance;
            }
            if (left.questionCount !== right.questionCount) {
                return left.questionCount - right.questionCount;
            }
            return left.timeLimit - right.timeLimit;
        })
        .map((item) => item.recommendedQuiz);

    if (options.preferredQuizId) {
        const preferred = recommendations.find((quiz) => quiz.quizId === options.preferredQuizId);
        if (preferred) {
            return [preferred, ...recommendations.filter((quiz) => quiz.quizId !== preferred.quizId)].slice(0, 5);
        }
    }

    return recommendations.slice(0, 5);
}

export function validateSmartPreviewRequest(body: SmartAssignmentPreviewRequest | null): SmartAssignmentPreviewRequest {
    if (!body) {
        throw new Error('Invalid JSON body');
    }

    const resultId = String(body.resultId || '').trim();
    const teacherUsername = String(body.teacherUsername || '').trim();

    if (!resultId) throw new Error('Missing resultId');
    if (!teacherUsername) throw new Error('Missing teacherUsername');

    return {
        resultId,
        teacherUsername,
        strategy: 'top_weak_skill',
        preferredQuizId: body.preferredQuizId ? String(body.preferredQuizId) : undefined,
        deadlinePreset: body.deadlinePreset || '7d',
        maxAttempts: Math.max(1, Number(body.maxAttempts) || 1),
    };
}

export async function getSmartAssignmentPreview(
    db: D1Database,
    request: SmartAssignmentPreviewRequest,
): Promise<SmartAssignmentPreviewResponse> {
    const payload = validateSmartPreviewRequest(request);
    const result = await getResultById(db, payload.resultId!);

    if (!result) {
        return {
            status: 'error',
            code: 'STUDENT_NOT_FOUND',
            message: 'Khong tim thay hoc sinh tu result hien tai.',
        };
    }

    const studentResolution = await resolveStudentFromResult(db, result, payload.teacherUsername!);
    if (studentResolution.type === 'error') {
        return {
            status: 'error',
            code: studentResolution.code,
            message: studentResolution.message,
            ...(studentResolution.code === 'AMBIGUOUS_STUDENT_MATCH'
                ? { data: { candidates: studentResolution.candidates } }
                : {}),
        };
    }

    const recentResults = await getRecentResultsForStudentContext(db, result);
    const questions = await getQuestionsForQuizIds(db, recentResults.map((item) => item.quiz_id));
    const weaknessProfile = buildWeaknessProfileFromData(result, recentResults, questions);
    const topSkill = pickTopWeakSkill(weaknessProfile.subjects.flatMap((subject) => subject.skills));

    if (!topSkill) {
        return {
            status: 'error',
            code: 'NO_RECOMMENDED_QUIZ',
            message: 'Chua tim thay quiz phu hop voi skill hien tai.',
        };
    }

    const topSubskill = pickTopSubskillForSkill(recentResults, questions, topSkill);
    const targetDifficulty = getTargetDifficulty(topSkill);

    const recommendedQuizzes = await findRecommendedQuizzes(db, {
        preferredQuizId: payload.preferredQuizId,
        currentQuizId: result.quiz_id,
        subject: topSkill.subject,
        skillCode: normalizeSkillCode(topSkill.skillCode),
        subskillCode: topSubskill.subskillCode,
        targetDifficulty,
    });

    if (recommendedQuizzes.length === 0) {
        return {
            status: 'error',
            code: 'NO_RECOMMENDED_QUIZ',
            message: 'Chua tim thay quiz phu hop voi skill hien tai.',
        };
    }

    const assignmentDraft: CreateAssignmentPayload = {
        quizId: recommendedQuizzes[0].quizId,
        classId: studentResolution.student.classId,
        studentId: studentResolution.student.id,
        deadline: getDeadlineFromPreset(payload.deadlinePreset),
        maxAttempts: payload.maxAttempts || 1,
    };

    const warnings: Array<{ code: string; message: string }> = [];
    if (weaknessProfile.coveragePercent < 70) {
        warnings.push({
            code: 'LOW_COVERAGE',
            message: `Weakness profile moi phu ${weaknessProfile.coveragePercent}% so cau. Nen xem day la goi y som.`,
        });
    }

    if (weaknessProfile.unclassifiedQuestionCount > 0) {
        warnings.push({
            code: 'UNCLASSIFIED_QUESTIONS',
            message: `Con ${weaknessProfile.unclassifiedQuestionCount} cau chua map duoc skill.`,
        });
    }

    return {
        status: 'success',
        data: {
            student: studentResolution.student,
            weaknessSummary: {
                resultId: String(result.id),
                coveragePercent: weaknessProfile.coveragePercent,
                basedOnResultIds: weaknessProfile.basedOnResultIds,
                topSkill: {
                    subject: topSkill.subject,
                    subjectLabel: getSubjectLabel(topSkill.subject),
                    skillCode: topSkill.skillCode,
                    skillLabel: getSkillLabel(topSkill.subject, topSkill.skillCode),
                    subskillCode: topSubskill.subskillCode,
                    subskillLabel: topSubskill.subskillLabel,
                    status: topSkill.status,
                    accuracy: topSkill.accuracy,
                    attempted: topSkill.attempted,
                    wrong: topSkill.wrong,
                    targetDifficulty,
                },
            },
            recommendedQuizzes,
            assignmentDraft,
            warnings,
        },
    };
}
