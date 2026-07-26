import { requireTeacherForAssignment, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { isStudent, requireTeacher } from '../../middleware/jwtAuth';
import { getSmartAssignmentPreview } from '../../services/smartAssignment';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleAssignmentSmartPreviewRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    // POST /api/assignments
        if (path === '/api/assignments/smart-preview' && method === 'POST') {
            if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            try {
                const preview = await getSmartAssignmentPreview(db, body);
                return jsonResponse(preview);
            } catch (error: any) {
                return errorResponse(error?.message || 'Khong the tao smart preview.');
            }
        }
    return null;
}
