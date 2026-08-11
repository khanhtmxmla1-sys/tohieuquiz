import { recordQuizActivity } from '../../gameLoop/activityService';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { normalizeGameLoopCategory } from '../../gameLoop/normalization';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

const LEGACY_PROGRESS_FIELDS = [
    'activityId', 'quizId', 'category', 'subject', 'correctCount', 'totalQuestions',
] as const;

export const handleTrackQuizRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    if (LEGACY_PROGRESS_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
        return errorResponse('Legacy quiz progress payload is not accepted');
    }

    const resultId = String(body.resultId || '').trim();
    if (!resultId) return errorResponse('Missing resultId');

    const student = await db.prepare(`
        SELECT id
        FROM students
        WHERE username = ?
        LIMIT 1
    `).bind(username).first<any>();
    if (!student?.id) return errorResponse('Student not found', 404);

    const savedResult = await db.prepare(`
        SELECT r.id, r.student_id, r.class_id, r.quiz_id, r.correct_count, r.total_questions,
               COALESCE(q.category, '') AS category
        FROM results r
        LEFT JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.id = ?
        LIMIT 1
    `).bind(resultId).first<any>();

    if (!savedResult || String(savedResult.student_id || '') !== String(student.id)) {
        return errorResponse('Result not found', 404);
    }

    const alreadyRecorded = await recordQuizActivity(db, username, {
        activityId: resultId,
        quizId: String(savedResult.quiz_id || ''),
        studentId: String(savedResult.student_id || ''),
        classId: savedResult.class_id ? String(savedResult.class_id) : null,
        category: normalizeGameLoopCategory(String(savedResult.category || '').trim()),
        totalQuestions: Math.max(0, Math.floor(Number(savedResult.total_questions) || 0)),
        correctCount: Math.max(0, Math.floor(Number(savedResult.correct_count) || 0)),
    });
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({ status: 'success', alreadyRecorded, data });
};
