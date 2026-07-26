import type { ClassroomRouteContext } from '../../classroom/types';
import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { errorResponse } from '../../utils/response';
import { handleAssignmentRoutes } from './assignmentRoutes';
import { handleClassRoutes } from './classRoutes';
import { handleStudentLoginRoute } from './studentLoginRoute';
import { handleStudentRoutes } from './studentRoutes';

export async function handleClassroomRoutes(
    request: Request, env: Env, path: string, method: string
): Promise<Response> {
    const loginResponse = await handleStudentLoginRoute(request, env, path, method);
    if (loginResponse) return loginResponse;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const context: ClassroomRouteContext = {
        request, env, path, method, db: env.DB,
        url: new URL(request.url), nowIso: new Date().toISOString(),
        user: authResult.user,
    };
    for (const handler of [handleClassRoutes, handleStudentRoutes, handleAssignmentRoutes]) {
        const response = await handler(context);
        if (response) return response;
    }
    return errorResponse('Not found: ' + path, 404);
}
