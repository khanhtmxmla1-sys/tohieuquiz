import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

export async function handleStudentListRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // GET /api/students?classId=X
        if (path === '/api/students' && method === 'GET') {
            const classId = url.searchParams.get('classId');
            if (!classId) return errorResponse('Missing classId parameter');

            const classroom = await getClassroomById(db, classId);
            if (!classroom) return errorResponse('Class not found', 404);
            if (!canAccessClass(user, classroom)) return errorResponse('Forbidden: You cannot access this class', 403);

            if (isStudent(user) && user.classId !== classId) return errorResponse('Forbidden: You can only access your class', 403);

            const role = isStudent(user) ? 'student' : 'teacher';
            const students = await db.prepare("SELECT * FROM students WHERE class_id = ? AND COALESCE(archived_at, '') = '' ORDER BY full_name COLLATE NOCASE").bind(classId).all();
            const mapped = students.results.map((s: any) => {
                const base: any = { id: s.id, fullName: s.full_name, username: s.username, classId: s.class_id, avatar: s.avatar || '' };
                if (role !== 'student') {
                    base.parentPhone = s.parent_phone || '';
                    base.createdAt = s.created_at;
                }
                return base;
            });
            return jsonResponse({ status: 'success', data: mapped });
        }
    return null;
}
