// Quizzes + Questions API Routes
// Public facade: route-specific behavior lives under ./quizzes.

import { Env } from '../types';
import { errorResponse } from '../utils/response';
import { handleAccessVerificationRoute, handlePlayQuestionsRoute } from './quizzes/accessRoutes';
import { handleQuizCatalogRoute } from './quizzes/readRoutes';
import { handleCreateQuizRoute, handleUpdateQuizRoute } from './quizzes/authoringRoutes';
import { handleVersionRoute, handleDuplicateRoute } from './quizzes/copyRoutes';
import { handleDeleteQuizRoute } from './quizzes/deleteRoute';

export {
    mapQuestionFromD1,
    sanitizeQuestionForStudent,
    sanitizeQuizForStudent,
} from './quizzes/questionDto';

export async function handleQuizRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    // Keep dispatch precedence identical to the original monolithic route.
    const accessVerification = await handleAccessVerificationRoute(request, env, path, method);
    if (accessVerification) return accessVerification;

    const playQuestions = await handlePlayQuestionsRoute(request, env, path, method);
    if (playQuestions) return playQuestions;

    const readRoute = await handleQuizCatalogRoute(request, env, path, method);
    if (readRoute) return readRoute;

    const createRoute = await handleCreateQuizRoute(request, env, path, method);
    if (createRoute) return createRoute;

    const updateRoute = await handleUpdateQuizRoute(request, env, path, method);
    if (updateRoute) return updateRoute;

    const versionRoute = await handleVersionRoute(request, env, path, method);
    if (versionRoute) return versionRoute;

    const duplicateRoute = await handleDuplicateRoute(request, env, path, method);
    if (duplicateRoute) return duplicateRoute;

    const deleteRoute = await handleDeleteQuizRoute(request, env, path, method);
    if (deleteRoute) return deleteRoute;

    return errorResponse('Not found: ' + path, 404);
}
