import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';
import { recordSecurityEvent, revokeAllAuthSessions } from '../../services/authSessionService';

export async function handleStudentResetPasswordRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // POST /api/students/:id/reset-password
        if (path.match(/\/api\/students\/[^/]+\/reset-password/) && method === 'POST') {
            const parts = path.split('/');
            const studentId = parts[3]; // /api/students/{id}/reset-password
            if (!studentId) return errorResponse('Missing student ID');

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            const studentError = await requireTeacherForStudent(db, user, studentId);
            if (studentError) return studentError;

            const newPassword = String(body.newPassword || '').trim();
            if (!newPassword) return errorResponse('Missing newPassword');
            if (newPassword.length < 6) {
                return errorResponse('Mật khẩu mới phải từ 6 ký tự.', 400);
            }

            const student = await db.prepare('SELECT id, username FROM students WHERE id = ?').bind(studentId).first<any>();
            if (!student) return errorResponse('Student not found', 404);

            const hash = await hashPassword(newPassword);
            const cutoff = new Date(nowIso);
            await db.prepare(`
                UPDATE students
                SET password_hash = ?, token_version = token_version + 1
                WHERE id = ?
            `).bind(hash, studentId).run();
            const targetUser = { username: String((student as any).username || studentId), role: 'student' as const };
            await revokeAllAuthSessions(db, targetUser, {
                actorUsername: user.username,
                requestId: request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID(),
                cutoff,
                reason: 'password_reset',
            });
            await recordSecurityEvent(db, {
                username: targetUser.username,
                role: 'student',
                eventType: 'PASSWORD_RESET',
                severity: 'action_required',
                actorUsername: user.username,
                requestId: request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID(),
                now: cutoff,
            });
            return jsonResponse({ status: 'success' });
        }
    return null;
}
