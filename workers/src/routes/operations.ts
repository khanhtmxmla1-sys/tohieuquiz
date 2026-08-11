import type { Env } from '../types';
import { requireAdmin, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { buildOperationsSnapshot } from '../services/operationsService';
import {
  getRewardReconciliationReport,
  getSuspiciousRewardGrowthReport,
  rebuildCurrentWeekProgress,
} from '../gamification/rewardSecurityMaintenance';
import { errorResponse, jsonResponse } from '../utils/response';

const noStoreResponse = (payload: unknown, status = 200): Response => {
  const response = jsonResponse(payload, status);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
};

export async function handleOperationsRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const isSnapshot = path === '/api/admin/operations';
  const isRewardAudit = path === '/api/admin/operations/rewards';
  const isRewardBackfill = path === '/api/admin/operations/rewards/rebuild-current-week';
  if (!isSnapshot && !isRewardAudit && !isRewardBackfill) return null;

  const allowed = (isSnapshot || isRewardAudit) ? method === 'GET' : method === 'POST';
  if (!allowed) return errorResponse('Method not allowed', 405);

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireAdmin(auth.user)) return errorResponse('Forbidden', 403);

  if (isRewardAudit) {
    const url = new URL(request.url);
    const sinceHours = Math.max(1, Math.min(24 * 30, Math.floor(Number(url.searchParams.get('sinceHours')) || 24)));
    const thresholdCoins = Math.max(1, Math.min(1_000_000, Math.floor(Number(url.searchParams.get('thresholdCoins')) || 1_000)));
    const limit = Math.max(1, Math.min(500, Math.floor(Number(url.searchParams.get('limit')) || 100)));
    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const [reconciliation, suspiciousGrowth] = await Promise.all([
      getRewardReconciliationReport(env.DB, limit),
      getSuspiciousRewardGrowthReport(env.DB, sinceIso, thresholdCoins, limit),
    ]);
    return noStoreResponse({
      status: 'success',
      data: {
        reconciliation,
        suspiciousGrowth,
        filters: { sinceIso, sinceHours, thresholdCoins, limit },
      },
    });
  }

  if (isRewardBackfill) {
    const data = await rebuildCurrentWeekProgress(env.DB);
    return noStoreResponse({ status: 'success', data });
  }

  const snapshot = await buildOperationsSnapshot(env, {
    requestId: request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID(),
  });
  return noStoreResponse({ status: 'success', data: snapshot });
}
