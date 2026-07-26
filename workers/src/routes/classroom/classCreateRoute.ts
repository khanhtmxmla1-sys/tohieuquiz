import type { ClassroomRouteContext } from '../../classroom/types';
import { getClassroomById } from '../../classroom/repositories';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleClassCreateRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // POST /api/classes
        if (path === '/api/classes' && method === 'POST') {
            if (!requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            const teacherUsername = String(body.teacherUsername || '').trim();
            const className = String(body.name || '').trim().replace(/\s+/g, ' ');
            if (!teacherUsername) return errorResponse('Missing teacherUsername');
            if (className.length < 2 || className.length > 80) return errorResponse('Tên lớp phải từ 2 đến 80 ký tự');

            const teacherExists = await db.prepare('SELECT username FROM teachers WHERE username = ?').bind(teacherUsername).first();
            if (!teacherExists) return errorResponse('Teacher not found', 404);
            const duplicate = await db.prepare("SELECT id FROM classes WHERE LOWER(TRIM(name)) = LOWER(?) AND COALESCE(archived_at, '') = ''")
                .bind(className).first();
            if (duplicate) return errorResponse('Tên lớp đang được sử dụng', 409);

            const id = generateId('c');
            const createdAt = new Date().toISOString();
            await db.prepare('INSERT INTO classes (id, name, teacher_username, created_at) VALUES (?, ?, ?, ?)')
                .bind(id, className, teacherUsername, createdAt).run();

            const teacher = await db.prepare('SELECT full_name FROM teachers WHERE username = ?')
                .bind(teacherUsername)
                .first<any>();

            return jsonResponse({
                status: 'success',
                data: {
                    id,
                    name: className,
                    teacherUsername,
                    teacherFullName: teacher?.full_name || '',
                    createdAt,
                },
            });
        }
    return null;
}
