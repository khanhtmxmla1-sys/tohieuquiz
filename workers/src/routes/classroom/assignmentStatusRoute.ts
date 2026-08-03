import { requireTeacherForAssignment, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { isStudent, requireTeacher } from '../../middleware/jwtAuth';
import { getSmartAssignmentPreview } from '../../services/smartAssignment';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleAssignmentStatusRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    // PUT /api/assignments/:id/status
        if (path.match(/\/api\/assignments\/[^/]+\/status/) && method === 'PUT') {
            const parts = path.split('/');
            const assignmentId = parts[3];
            if (!assignmentId) return errorResponse('Missing assignment ID');

            const assignmentError = await requireTeacherForAssignment(db, user, assignmentId);
            if (assignmentError) return assignmentError;

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            const s = String(body.newStatus || 'CLOSED').toUpperCase();
            if (!['OPEN', 'CLOSED'].includes(s)) {
                return jsonResponse({
                    status: 'error',
                    code: 'ASSIGNMENT_STATUS_INVALID',
                    message: 'Trạng thái bài giao chỉ có thể là OPEN hoặc CLOSED.',
                }, 400);
            }
            const current = await db.prepare('SELECT status FROM assignments WHERE id = ?')
                .bind(assignmentId).first<{ status: string }>();
            if (String(current?.status || '').toUpperCase() === 'REVOKED') {
                return jsonResponse({
                    status: 'error',
                    code: 'ASSIGNMENT_REVOKED',
                    message: 'Bài đã được thu hồi và không thể mở lại.',
                }, 409);
            }
            await db.prepare('UPDATE assignments SET status = ? WHERE id = ?').bind(s, assignmentId).run();
            return jsonResponse({ status: 'success', data: { assignmentId, status: s } });
        }
    return null;
}
