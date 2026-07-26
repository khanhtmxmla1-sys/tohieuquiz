import type { ClassroomRouteContext } from '../../classroom/types';
import { getClassroomById } from '../../classroom/repositories';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleClassArchiveRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // PATCH /api/classes/:id/archive (soft delete/restore to preserve learning history)
        if (path.match(/\/api\/classes\/[^/]+\/archive/) && method === 'PATCH') {
            if (!requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);
            const classId = path.split('/')[3];
            const body = await parseBody(request);
            if (!classId || !body) return errorResponse('Invalid archive request');
            const classroom = await getClassroomById(db, classId);
            if (!classroom) return errorResponse('Class not found', 404);
            const shouldArchive = body.archived !== false;
            const archivedAt = shouldArchive ? nowIso : null;
            if (shouldArchive) {
                await db.batch([
                    db.prepare('UPDATE classes SET archived_at = ? WHERE id = ?').bind(archivedAt, classId),
                    db.prepare("UPDATE students SET archived_at = ? WHERE class_id = ? AND COALESCE(archived_at, '') = ''").bind(archivedAt, classId),
                ]);
            } else {
                const previousArchivedAt = String(classroom.archived_at || '');
                await db.batch([
                    db.prepare('UPDATE classes SET archived_at = NULL WHERE id = ?').bind(classId),
                    db.prepare('UPDATE students SET archived_at = NULL WHERE class_id = ? AND archived_at = ?').bind(classId, previousArchivedAt),
                ]);
            }
            return jsonResponse({ status: 'success', data: { id: classId, archivedAt: archivedAt || '' } });
        }
    return null;
}
