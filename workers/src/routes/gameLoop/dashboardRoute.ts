import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { jsonResponse } from '../../utils/response';

export const handleDashboardRoute = async (
    db: D1Database,
    username: string
): Promise<Response> => {
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({ status: 'success', data });
};
