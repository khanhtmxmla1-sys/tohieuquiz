import { jsonResponse } from '../../utils/response';

export interface QuizUsage {
    resultCount: number;
    activeLiveExamCount: number;
    openAssignmentCount: number;
}

const readCount = (row: { count?: number } | null): number => Number(row?.count || 0);

export const loadQuizUsage = async (db: D1Database, quizId: string): Promise<QuizUsage> => {
    const [results, liveExams, assignments] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS count FROM results WHERE quiz_id = ?').bind(quizId).first<{ count: number }>(),
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM live_exam_sessions WHERE quiz_id = ? AND status IN ('waiting', 'active', 'scoring')
        `).bind(quizId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) AS count FROM assignments WHERE quiz_id = ? AND status = 'OPEN'")
            .bind(quizId).first<{ count: number }>(),
    ]);
    return {
        resultCount: readCount(results),
        activeLiveExamCount: readCount(liveExams),
        openAssignmentCount: readCount(assignments),
    };
};

export const buildQuizEditability = (usage: QuizUsage) => {
    const reason = usage.activeLiveExamCount > 0
        ? 'LIVE_EXAM_ACTIVE'
        : usage.resultCount > 0
            ? 'HAS_SUBMISSIONS'
            : null;
    const canEditStructure = reason === null;
    return {
        mode: canEditStructure ? 'EDIT' : 'READONLY',
        canEditStructure,
        canCreateVersion: true,
        reason,
        requiresPublishedWarning: canEditStructure && usage.openAssignmentCount > 0,
        ...usage,
    };
};

export const quizConflictResponse = (
    code: string,
    message: string,
    details: Record<string, unknown> = {},
): Response => jsonResponse({ status: 'error', code, message, ...details }, 409);

export const inferQuizSourceType = (body: Record<string, any>): string => {
    const requested = String(body.sourceType || body.source_type || '').trim();
    if (requested) return requested;
    return body.aiGeneration ? 'ai' : 'manual';
};

export const toEditorQuizDto = (quiz: import('../../types').Quiz) => ({
    id: quiz.id,
    title: quiz.title,
    classLevel: quiz.class_level,
    category: quiz.category || '',
    timeLimit: quiz.time_limit,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at || quiz.created_at,
    createdBy: quiz.created_by || '',
    accessCode: quiz.access_code || undefined,
    requireCode: String(quiz.require_code || '').toUpperCase() === 'TRUE',
    showOnHome: String(quiz.show_on_home || 'TRUE').toUpperCase() !== 'FALSE',
    tags: (() => {
        try { return JSON.parse(quiz.tags || '[]'); } catch { return []; }
    })(),
    sourceType: quiz.source_type || 'manual',
    parentQuizId: quiz.parent_quiz_id || null,
    versionNumber: Number(quiz.version_number || 1),
    revision: Number(quiz.revision || 1),
});
