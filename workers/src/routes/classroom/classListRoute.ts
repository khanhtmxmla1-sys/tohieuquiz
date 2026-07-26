import type { ClassroomRouteContext } from '../../classroom/types';
import { getClassroomById } from '../../classroom/repositories';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleClassListRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // GET /api/classes
        if (path === '/api/classes' && method === 'GET') {
            if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);

            const includeArchived = requireAdmin(user) && url.searchParams.get('includeArchived') === 'true';
            let query = `
                SELECT
                    c.*,
                    t.full_name AS teacher_full_name,
                    (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND COALESCE(s.archived_at, '') = '') AS student_count,
                    (SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id) AS assignment_count,
                    (SELECT MAX(r.submitted_at) FROM results r WHERE LOWER(TRIM(r.class_name)) = LOWER(TRIM(c.name))) AS last_activity_at
                FROM classes c
                LEFT JOIN teachers t ON t.username = c.teacher_username
            `;
            const params: any[] = [];
            const conditions: string[] = [];
            if (!requireAdmin(user)) {
                conditions.push('c.teacher_username = ?');
                params.push(user.username);
            }
            if (!includeArchived) conditions.push("COALESCE(c.archived_at, '') = ''");
            if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
            query += ' ORDER BY c.name COLLATE NOCASE';
            const rows = await db.prepare(query).bind(...params).all();
            return jsonResponse({
                status: 'success',
                data: rows.results.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    teacherUsername: r.teacher_username,
                    teacherFullName: r.teacher_full_name || '',
                    createdAt: r.created_at,
                    studentCount: Number(r.student_count) || 0,
                    assignmentCount: Number(r.assignment_count) || 0,
                    lastActivityAt: r.last_activity_at || '',
                    archivedAt: r.archived_at || '',
                })),
            });
        }
    return null;
}
