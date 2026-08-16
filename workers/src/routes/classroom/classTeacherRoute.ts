import type { ClassroomRouteContext } from '../../classroom/types';
import { getClassroomById } from '../../classroom/repositories';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleClassTeacherRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // PATCH /api/classes/:id/teacher
        if (path.match(/\/api\/classes\/[^/]+\/teacher/) && method === 'PATCH') {
            const parts = path.split('/');
            const classId = parts[3]; // /api/classes/{id}/teacher
            if (!classId) return errorResponse('Missing class ID');

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            if (!requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);

            const newTeacherUsername = String(body.teacherUsername || '').trim();
            if (!newTeacherUsername) return errorResponse('Missing teacherUsername');

            const classroom = await db.prepare('SELECT id, name, teacher_username, created_at FROM classes WHERE id = ?')
                .bind(classId)
                .first<any>();
            if (!classroom) return errorResponse('Class not found', 404);

            const teacher = await db.prepare('SELECT username, full_name, role, status FROM teachers WHERE username = ?')
                .bind(newTeacherUsername)
                .first<any>();
            if (!teacher) return errorResponse('Teacher not found', 404);
            if (String(teacher.status || '').toUpperCase() !== 'ACTIVE') {
                return errorResponse('Giáo viên nhận lớp đang bị vô hiệu hóa.', 409);
            }
            if (String(teacher.role || '').toLowerCase() !== 'teacher') {
                return errorResponse('Tài khoản nhận lớp phải có vai trò giáo viên.', 400);
            }

            const className = String(classroom.name || '').trim();
            const oldTeacherUsername = String(classroom.teacher_username || '').trim();

            await db.prepare('UPDATE classes SET teacher_username = ? WHERE id = ?').bind(newTeacherUsername, classId).run();

            if (oldTeacherUsername && oldTeacherUsername !== newTeacherUsername) {
                await db.prepare('UPDATE teachers SET class = ? WHERE username = ? AND class = ?')
                    .bind('', oldTeacherUsername, className)
                    .run();
            }

            await db.prepare('UPDATE teachers SET class = ? WHERE username = ?')
                .bind(className, newTeacherUsername)
                .run();

            return jsonResponse({
                status: 'success',
                data: {
                    id: classroom.id,
                    name: classroom.name,
                    teacherUsername: newTeacherUsername,
                    teacherFullName: teacher.full_name || '',
                    createdAt: classroom.created_at,
                },
            });
        }
    return null;
}
