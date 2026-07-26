import { requireTeacherForAssignment, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { isStudent, requireTeacher } from '../../middleware/jwtAuth';
import { getSmartAssignmentPreview } from '../../services/smartAssignment';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleAssignmentDeleteRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    // DELETE /api/assignments/:id
        if (path.startsWith('/api/assignments/') && !path.includes('/deadline') && !path.includes('/status') && !path.includes('/start') && method === 'DELETE') {
            const assignmentId = extractIdFromPath(path, '/api/assignments');
            if (!assignmentId) return errorResponse('Missing assignment ID');

            const assignmentError = await requireTeacherForAssignment(db, user, assignmentId);
            if (assignmentError) return assignmentError;

            await db.prepare('DELETE FROM assignments WHERE id = ?').bind(assignmentId).run();
            return jsonResponse({ status: 'success' });
        }
    return null;
}
