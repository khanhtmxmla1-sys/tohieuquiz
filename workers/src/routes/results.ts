// Results + Validate API Routes
// Public facade: route-specific behavior lives under ./results.

import type { Env } from '../types';
import { errorResponse } from '../utils/response';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import { handleInterventionRoutes } from './interventions';
import { handleResultReadRoutes } from './results/readRoutes';
import { handleResultAnalysisRoutes } from './results/analysisRoutes';
import { handleResultSubmitRoute } from './results/submitRoute';
import { handleResultDeleteRoute } from './results/deleteRoute';
import { handleResultValidateRoute } from './results/validateRoute';
import type { ResultRouteContext } from './results/context';

export async function handleResultRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const interventionResponse = await handleInterventionRoutes({
        request,
        env,
        user,
        path,
        method,
    });
    if (interventionResponse) return interventionResponse;

    const context: ResultRouteContext = {
        request,
        env,
        db: env.DB,
        user,
        path,
        method,
    };

    // Keep dispatch precedence identical to the original monolithic route.
    const readRoute = await handleResultReadRoutes(context);
    if (readRoute) return readRoute;

    const analysisRoute = await handleResultAnalysisRoutes(context);
    if (analysisRoute) return analysisRoute;

    const submitRoute = await handleResultSubmitRoute(context);
    if (submitRoute) return submitRoute;

    const deleteRoute = await handleResultDeleteRoute(context);
    if (deleteRoute) return deleteRoute;

    const validateRoute = await handleResultValidateRoute(context);
    if (validateRoute) return validateRoute;

    return errorResponse('Not found: ' + path, 404);
}
