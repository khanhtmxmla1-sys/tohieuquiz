import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

export async function handleStudentChangePasswordRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // POST /api/students/:id/change-password
        if (path.match(/\/api\/students\/[^/]+\/change-password/) && method === 'POST') {
            const parts = path.split('/');
            const studentId = parts[3]; // /api/students/{id}/change-password
            if (!studentId) return errorResponse('Missing student ID');

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            const student = await getStudentById(db, studentId);
            if (!student) return errorResponse('Student not found', 404);
            if (!isStudent(user) || user.username !== student.username) {
                return errorResponse('Forbidden: You can only change your own password', 403);
            }

            const currentPassword = String(body.currentPassword || '').trim();
            const newPassword = String(body.newPassword || '').trim();
            if (!currentPassword || !newPassword) {
                return errorResponse('Missing currentPassword or newPassword');
            }
            if (newPassword.length < 6) {
                return errorResponse('Mật khẩu mới phải từ 6 ký tự.', 400);
            }

            const studentWithPassword = await db.prepare('SELECT id, password_hash FROM students WHERE id = ?').bind(studentId).first<any>();
            if (!studentWithPassword) return errorResponse('Student not found', 404);

            const currentPasswordCheck = await verifyPassword(currentPassword, String(studentWithPassword.password_hash || ''));
            if (!currentPasswordCheck.valid) {
                return errorResponse('Mật khẩu cũ không đúng.', 400);
            }

            const newHash = await hashPassword(newPassword);
            await db.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(newHash, studentId).run();
            return jsonResponse({ status: 'success' });
        }
    return null;
}
