import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

export async function handleStudentAvatarRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // PUT /api/students/:id/avatar
        if (path.match(/\/api\/students\/[^/]+\/avatar/) && method === 'PUT') {
            const parts = path.split('/');
            const studentId = parts[3]; // /api/students/{id}/avatar
            if (!studentId) return errorResponse('Missing student ID');

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            const student = await getStudentById(db, studentId);
            if (!student) return errorResponse('Student not found', 404);
            if (!isStudent(user) || user.username !== student.username) {
                return errorResponse('Forbidden: You can only update your own avatar', 403);
            }

            await db.prepare('UPDATE students SET avatar = ? WHERE id = ?').bind(body.avatar || '', studentId).run();
            return jsonResponse({ status: 'success', data: { avatar: body.avatar } });
        }
    return null;
}
