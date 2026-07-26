import { requireTeacherForAssignment } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

export async function handleAssignmentDeadlineRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    if (!path.match(/\/api\/assignments\/[^/]+\/deadline/) || method !== 'PUT') return null;

    const assignmentId = path.split('/')[3];
    if (!assignmentId) return errorResponse('Missing assignment ID');

    const assignmentError = await requireTeacherForAssignment(db, user, assignmentId);
    if (assignmentError) return assignmentError;

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const deadlineMs = Date.parse(String(body.newDeadline || ''));
    if (!Number.isFinite(deadlineMs)) return errorResponse('newDeadline must be a valid date');
    if (deadlineMs <= Date.parse(nowIso)) return errorResponse('newDeadline must be in the future');

    const newDeadline = new Date(deadlineMs).toISOString();
    await db.prepare('UPDATE assignments SET deadline = ?, status = ? WHERE id = ?')
        .bind(newDeadline, 'OPEN', assignmentId).run();
    return jsonResponse({ status: 'success', data: { assignmentId, newDeadline, status: 'OPEN' } });
}
