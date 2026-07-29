import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../../utils/cursorPagination';

export async function handleStudentListRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // GET /api/students?classId=X - bounded stable cursor page.
    if (path === '/api/students' && method === 'GET') {
        const classId = url.searchParams.get('classId');
        if (!classId) return errorResponse('Missing classId parameter');

        const classroom = await getClassroomById(db, classId);
        if (!classroom) return errorResponse('Class not found', 404);
        if (!canAccessClass(user, classroom)) return errorResponse('Forbidden: You cannot access this class', 403);
        if (isStudent(user) && user.classId !== classId) {
            return errorResponse('Forbidden: You can only access your class', 403);
        }

        let limit: number;
        let cursor: string[] | null;
        try {
            limit = collectionLimit(url);
            cursor = decodeCollectionCursor(url.searchParams.get('cursor'), 'students', 2);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Pagination invalid', 400);
        }

        const role = isStudent(user) ? 'student' : 'teacher';
        const where = ["class_id = ?", "COALESCE(archived_at, '') = ''"];
        const bindings: unknown[] = [classId];
        if (cursor) {
            where.push('(LOWER(full_name) > ? OR (LOWER(full_name) = ? AND id > ?))');
            bindings.push(cursor[0], cursor[0], cursor[1]);
        }
        const rows = await db.prepare(`
            SELECT id, full_name, username, class_id, avatar, parent_phone, created_at
            FROM students
            WHERE ${where.join(' AND ')}
            ORDER BY full_name COLLATE NOCASE ASC, id ASC
            LIMIT ?
        `).bind(...bindings, limit + 1).all<any>();
        const sourceRows = rows.results || [];
        const pageRows = sourceRows.slice(0, limit);
        const mapped = pageRows.map((student) => {
            const base: any = {
                id: student.id,
                fullName: student.full_name,
                username: student.username,
                classId: student.class_id,
                avatar: student.avatar || '',
            };
            if (role !== 'student') {
                base.parentPhone = student.parent_phone || '';
                base.createdAt = student.created_at;
            }
            return base;
        });
        const last = pageRows.at(-1);
        const hasMore = sourceRows.length > limit;
        return jsonResponse({
            status: 'success',
            data: mapped,
            meta: {
                limit,
                hasMore,
                nextCursor: hasMore && last
                    ? encodeCollectionCursor('students', [String(last.full_name || '').toLowerCase(), last.id])
                    : null,
            },
        });
    }
    return null;
}
