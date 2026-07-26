import type { ClassroomRouteContext } from '../../classroom/types';
import { getClassroomById } from '../../classroom/repositories';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleClassDeleteRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // Permanent deletion is intentionally disabled; historical data must remain traceable.
        if (path.startsWith('/api/classes/') && method === 'DELETE') {
            return errorResponse('Permanent class deletion is disabled. Archive the class instead.', 405);
        }
    return null;
}
