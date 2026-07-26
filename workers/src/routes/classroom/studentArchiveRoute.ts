import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

export async function handleStudentArchiveRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // DELETE /api/students/:id
        if (
            path.startsWith('/api/students/')
            && !path.includes('/reset-password')
            && !path.includes('/change-password')
            && !path.includes('/avatar')
            && method === 'DELETE'
        ) {
            const studentId = extractIdFromPath(path, '/api/students');
            if (!studentId) return errorResponse('Missing student ID');

            const studentError = await requireTeacherForStudent(db, user, studentId);
            if (studentError) return studentError;

            await db.prepare('UPDATE students SET archived_at = ? WHERE id = ?').bind(nowIso, studentId).run();
            return jsonResponse({ status: 'success' });
        }
    return null;
}
