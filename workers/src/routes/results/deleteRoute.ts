import { jsonResponse, errorResponse } from '../../utils/response';
import { requireAdmin } from '../../middleware/jwtAuth';
import { requireResultAccess } from './resultAccess';
import type { ResultRouteContext } from './context';

export async function handleResultDeleteRoute(context: ResultRouteContext): Promise<Response | null> {
    const { db, user, path, method } = context;

    if (path.match(/^\/api\/results\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        if (!id) return errorResponse('Result id is required', 400);
        const access = await requireResultAccess(db, user, id);
        if (access instanceof Response) return access;
        if (!requireAdmin(user) && user.role !== 'teacher') {
            return errorResponse('Forbidden: Teacher or admin access required', 403);
        }

        await db.prepare('DELETE FROM results WHERE id = ?').bind(id).run();
        return jsonResponse({ status: 'success' });
    }

    return null;
}
