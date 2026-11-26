import { jsonResponse } from '../../utils/response';
import {
    buildResultSkillBreakdownFromData,
    buildWeaknessProfileFromData,
    getQuestionsForQuizIds,
    getRecentResultsForStudentContext,
} from '../../services/weaknessProfile';
import { canAccessCanonicalResult } from '../../services/resultAccess';
import { requireResultAccess } from './resultAccess';
import type { ResultRouteContext } from './context';

export async function handleResultAnalysisRoutes(context: ResultRouteContext): Promise<Response | null> {
    const { db, user, path, method } = context;

    // GET /api/results/:id/skill-breakdown
    if (path.match(/^\/api\/results\/[^/]+\/skill-breakdown$/) && method === 'GET') {
        const resultId = path.split('/')[3];
        const access = await requireResultAccess(db, user, resultId);
        if (access instanceof Response) return access;
        const { result } = access;

        const questions = await getQuestionsForQuizIds(db, [result.quiz_id]);
        return jsonResponse(buildResultSkillBreakdownFromData(result, questions));
    }

    // GET /api/results/:id/weakness-profile
    if (path.match(/^\/api\/results\/[^/]+\/weakness-profile$/) && method === 'GET') {
        const resultId = path.split('/')[3];
        const access = await requireResultAccess(db, user, resultId);
        if (access instanceof Response) return access;
        const { result, scope } = access;

        const recentResults = await getRecentResultsForStudentContext(db, result);
        const visibleRecentResults = recentResults.filter((item) => canAccessCanonicalResult(scope, item));
        const questions = await getQuestionsForQuizIds(db, visibleRecentResults.map((item) => item.quiz_id));
        return jsonResponse(buildWeaknessProfileFromData(result, visibleRecentResults, questions));
    }

    return null;
}
