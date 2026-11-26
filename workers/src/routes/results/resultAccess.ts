import { errorResponse } from '../../utils/response';
import type { JWTPayload } from '../../utils/jwt';
import {
    canAccessCanonicalResult,
    resolveResultAccessScope,
    type ResultAccessScope,
} from '../../services/resultAccess';
import { getResultById } from '../../services/weaknessProfile';

export const requireResultAccess = async (
    db: D1Database,
    user: JWTPayload,
    resultId: string,
): Promise<{ result: any; scope: ResultAccessScope } | Response> => {
    const result = await getResultById(db, resultId);
    if (!result) return errorResponse('Result not found', 404);
    const scope = await resolveResultAccessScope(db, user);
    if (!canAccessCanonicalResult(scope, result)) {
        return errorResponse('Forbidden: You do not have access to this result', 403);
    }
    return { result, scope };
};
