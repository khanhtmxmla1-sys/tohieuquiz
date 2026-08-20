import {
  CreateCompetitionCampaignRequestSchema,
  UpdateCompetitionCampaignRequestSchema,
} from '../../../../schemas/competition.schema';
import type { Env } from '../../types';
import { requireAdmin, requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import {
  createCompetitionCampaign,
  freezeCompetitionAudience,
  getCompetitionCampaign,
  listCompetitionAudience,
  listCompetitionCampaigns,
  previewCompetitionAudience,
  updateCompetitionCampaign,
} from '../../competition/campaignService';
import { errorResponse, jsonResponse } from '../../utils/response';
import type { JWTPayload } from '../../utils/jwt';

function routeCampaignId(path: string, suffix = ''): string | null {
  const prefix = '/api/competitions/';
  if (!path.startsWith(prefix)) return null;

  const remainder = path.slice(prefix.length);
  if (suffix) {
    if (!remainder.endsWith(suffix)) return null;
    const rawId = remainder.slice(0, -suffix.length);
    if (!rawId || rawId.includes('/')) return null;
    return decodeURIComponent(rawId);
  }

  if (!remainder || remainder.includes('/')) return null;
  return decodeURIComponent(remainder);
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function teacherClassIds(db: D1Database, user: JWTPayload): Promise<string[] | undefined> {
  if (requireAdmin(user)) return undefined;
  const result = await db.prepare(`
    SELECT id
    FROM classes
    WHERE teacher_username = ? AND COALESCE(archived_at, '') = ''
    ORDER BY id ASC
  `).bind(user.username).all<{ id: string }>();
  return (result.results || []).map((row) => row.id);
}

function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'COMPETITION_REQUEST_FAILED';
  if (message === 'COMPETITION_CAMPAIGN_NOT_FOUND') return errorResponse(message, 404);
  if (message === 'COMPETITION_CAMPAIGN_NOT_DRAFT') return errorResponse(message, 409);
  if (message === 'COMPETITION_AUDIENCE_NOT_SNAPSHOTTED') return errorResponse(message, 409);
  if (message === 'COMPETITION_AUDIENCE_CURSOR_INVALID') return errorResponse(message, 400);
  return errorResponse(message, 400);
}

export async function handleCompetitionRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (!path.startsWith('/api/competitions')) return null;

  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;
  if (!requireTeacher(user)) return errorResponse('Forbidden', 403);

  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isMutation && !requireAdmin(user)) return errorResponse('Forbidden', 403);

  try {
    if (path === '/api/competitions' && method === 'POST') {
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateCompetitionCampaignRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition campaign payload', 400);
      const campaign = await createCompetitionCampaign(env.DB, parsed.data, user.username);
      return jsonResponse({ campaign }, 201);
    }

    if (path === '/api/competitions' && method === 'GET') {
      const items = await listCompetitionCampaigns(env.DB);
      return jsonResponse({ items });
    }

    const previewCampaignId = routeCampaignId(path, '/audience/preview');
    if (previewCampaignId && method === 'POST') {
      const preview = await previewCompetitionAudience(env.DB, previewCampaignId);
      return jsonResponse({ preview });
    }

    const snapshotCampaignId = routeCampaignId(path, '/audience/snapshot');
    if (snapshotCampaignId && method === 'POST') {
      const body = await jsonBody(request);
      const requestId = String(body?.requestId || '').trim();
      if (requestId.length < 8) return errorResponse('requestId is required', 400);
      const snapshot = await freezeCompetitionAudience(
        env.DB,
        snapshotCampaignId,
        user.username,
        requestId,
      );
      return jsonResponse({ snapshot }, 201);
    }

    const audienceCampaignId = routeCampaignId(path, '/audience');
    if (audienceCampaignId && method === 'GET') {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit') || 50);
      const cursor = url.searchParams.get('cursor') || undefined;
      const classIds = await teacherClassIds(env.DB, user);
      const audience = await listCompetitionAudience(env.DB, audienceCampaignId, {
        limit,
        cursor,
        classIds,
      });
      return jsonResponse(audience);
    }

    const campaignId = routeCampaignId(path);
    if (campaignId && method === 'GET') {
      const campaign = await getCompetitionCampaign(env.DB, campaignId);
      if (!campaign) return errorResponse('COMPETITION_CAMPAIGN_NOT_FOUND', 404);
      return jsonResponse({ campaign });
    }

    if (campaignId && method === 'PATCH') {
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = UpdateCompetitionCampaignRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition campaign payload', 400);
      const campaign = await updateCompetitionCampaign(env.DB, campaignId, parsed.data, user.username);
      return jsonResponse({ campaign });
    }

    return null;
  } catch (error) {
    return routeError(error);
  }
}
