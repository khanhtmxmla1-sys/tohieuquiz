import type { ClassroomRouteContext } from '../../classroom/types';
import { isStudent } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

const normalizeIdentityText = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export async function handleAssignmentStartRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    if (!path.match(/^\/api\/assignments\/[^/]+\/start$/) || method !== 'POST') return null;

    const assignmentId = path.split('/')[3];
    if (!assignmentId) return errorResponse('Missing assignment ID');

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    if (!isStudent(user)) return errorResponse('Forbidden: Student access required', 403);

    const student = await db.prepare(`
        SELECT s.*, c.name AS class_name
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.username = ?
    `).bind(user.username).first<any>();
    if (!student) {
        return jsonResponse({
            status: 'error',
            code: 'STUDENT_NOT_FOUND',
            message: 'Không tìm thấy tài khoản học sinh.',
        }, 404);
    }

    const assignment = await db.prepare('SELECT * FROM assignments WHERE id = ?')
        .bind(assignmentId)
        .first<any>();
    if (!assignment) {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_NOT_FOUND',
            message: 'Không tìm thấy bài được giao.',
        }, 404);
    }

    if (String(assignment.class_id || '') !== String(student.class_id || '')) {
        return errorResponse('Forbidden: Assignment is not for your class', 403);
    }
    if (String(assignment.student_id || '') && String(assignment.student_id) !== String(student.id || '')) {
        return errorResponse('Forbidden: Assignment is not assigned to you', 403);
    }

    const status = String(assignment.status || 'OPEN').toUpperCase();
    const deadline = String(assignment.deadline || '');
    const deadlineMs = Date.parse(deadline);
    const nowMs = Date.parse(nowIso);
    const isExpired = Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && deadlineMs < nowMs;

    if (status === 'REVOKED') {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_REVOKED',
            message: 'Bài đã được giáo viên thu hồi.',
        }, 409);
    }

    if (isExpired) {
        if (status === 'OPEN') {
            await db.prepare("UPDATE assignments SET status = 'CLOSED' WHERE id = ?")
                .bind(assignmentId)
                .run();
        }
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_EXPIRED',
            message: 'Bài tập đã hết hạn.',
        }, 409);
    }

    if (status !== 'OPEN') {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_CLOSED',
            message: 'Bài tập đã được giáo viên đóng.',
        }, 409);
    }

    const countResult = await db.prepare(`
        SELECT COUNT(*) as cnt FROM results
        WHERE assignment_id = ?
          AND COALESCE(answers, '') != '{"status":"STARTED"}'
          AND (
            student_id = ?
            OR (
              (student_id IS NULL OR student_id = '')
              AND LOWER(TRIM(student_name)) = ?
              AND LOWER(TRIM(class_name)) = ?
            )
          )
    `).bind(
        assignmentId,
        student.id,
        normalizeIdentityText(student.full_name),
        normalizeIdentityText(student.class_name),
    ).first<{ cnt: number }>();

    const attemptCount = Number(countResult?.cnt || 0);
    const maxAttempts = Math.max(1, Number(assignment.max_attempts) || 1);
    if (attemptCount >= maxAttempts) {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
            message: `Em đã hết lượt làm bài này (${attemptCount}/${maxAttempts}).`,
            attemptCount,
            maxAttempts,
        }, 409);
    }

    return jsonResponse({
        status: 'success',
        data: {
            assignmentId,
            attemptCount,
            maxAttempts,
            remainingAttempts: maxAttempts - attemptCount,
            deadline,
            status: 'OPEN',
        },
    });
}
