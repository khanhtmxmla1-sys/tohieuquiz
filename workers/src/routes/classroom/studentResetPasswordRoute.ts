import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

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

            const student = await db.prepare('SELECT id FROM students WHERE id = ?').bind(studentId).first<any>();
            if (!student) return errorResponse('Student not found', 404);

            const hash = await hashPassword(newPassword);
            await db.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(hash, studentId).run();
            return jsonResponse({ status: 'success' });
        }
    return null;
}
