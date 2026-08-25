import {
  ActivateCompetitionAwardRuleVersionRequestSchema,
  CreateCompetitionArticleRequestSchema,
  CreateCompetitionAwardRuleVersionRequestSchema,
  UpdateCompetitionArticleRequestSchema,
  UpdateCompetitionGoldenBoardConfigRequestSchema,
  UpdateCompetitionPublicPageRequestSchema,
} from '../../../../schemas/competitionPortal.schema';
import {
  archivePublicPage,
  getPublicPageForStaff,
  previewPublicPage,
  publishPublicPage,
  updatePublicPageDraft,
} from '../../competition/publicPageService';
import {
  createCompetitionArticle,
  deleteCompetitionArticle,
  getCompetitionArticleForStaff,
  listCompetitionArticlesForStaff,
  updateCompetitionArticle,
} from '../../competition/competitionArticleService';
import {
  activateAwardRuleVersion,
  createAwardRuleVersion,
  getGoldenBoardConfig,
  listAwardRuleVersions,
  updateGoldenBoardConfig,
} from '../../competition/goldenBoardConfigService';
import {
  competitionAudienceIntersectsClassScope,
  getCompetitionCampaign,
} from '../../competition/campaignService';
import { errorResponse, jsonResponse } from '../../utils/response';
import type { JWTPayload } from '../../utils/jwt';

type PortalResource =
  | { kind: 'public-page'; campaignId: string; action?: 'preview' | 'publish' | 'archive' }
  | { kind: 'articles'; campaignId: string; articleId?: string }
  | { kind: 'golden-board-config'; campaignId: string }
  | { kind: 'award-rules'; campaignId: string; version?: number; activate?: true };

function decoded(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parsePortalResource(path: string): PortalResource | null {
  let match = path.match(/^\/api\/competitions\/([^/]+)\/public-page(?:\/(preview|publish|archive))?$/);
  if (match) {
    const campaignId = decoded(match[1]);
    return campaignId
      ? { kind: 'public-page', campaignId, action: match[2] as 'preview' | 'publish' | 'archive' | undefined }
      : null;
  }
  match = path.match(/^\/api\/competitions\/([^/]+)\/articles(?:\/([^/]+))?$/);
  if (match) {
    const campaignId = decoded(match[1]);
    const articleId = match[2] ? decoded(match[2]) : undefined;
    return campaignId && (!match[2] || articleId)
      ? { kind: 'articles', campaignId, articleId: articleId || undefined }
      : null;
  }
  match = path.match(/^\/api\/competitions\/([^/]+)\/golden-board-config$/);
  if (match) {
    const campaignId = decoded(match[1]);
    return campaignId ? { kind: 'golden-board-config', campaignId } : null;
  }
  match = path.match(/^\/api\/competitions\/([^/]+)\/award-rules(?:\/([^/]+)\/activate)?$/);
  if (match) {
    const campaignId = decoded(match[1]);
    if (!campaignId) return null;
    if (match[2] === undefined) return { kind: 'award-rules', campaignId };
    const version = Number(decoded(match[2]));
    return Number.isInteger(version) && version > 0
      ? { kind: 'award-rules', campaignId, version, activate: true }
      : null;
  }
  return null;
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

async function canAccessCampaign(
  db: D1Database,
  campaignId: string,
  user: JWTPayload,
  teacherClassIds: string[] | undefined,
): Promise<boolean> {
  if (user.role === 'admin') return Boolean(await getCompetitionCampaign(db, campaignId));
  return competitionAudienceIntersectsClassScope(db, campaignId, teacherClassIds || []);
}

function portalError(error: unknown): Response {
  const code = error instanceof Error ? error.message : 'COMPETITION_PORTAL_REQUEST_FAILED';
  if ([
    'COMPETITION_CAMPAIGN_NOT_FOUND',
    'COMPETITION_PUBLIC_PAGE_NOT_FOUND',
    'COMPETITION_ARTICLE_NOT_FOUND',
    'COMPETITION_AWARD_RULE_VERSION_NOT_FOUND',
    'GOLDEN_BOARD_SOURCE_EVENT_NOT_FOUND',
    'GOLDEN_BOARD_AWARD_VERSION_NOT_FOUND',
  ].includes(code)) return errorResponse(code, 404);
  if ([
    'COMPETITION_PUBLIC_PAGE_NOT_DRAFT',
    'COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION',
    'COMPETITION_PUBLIC_PAGE_SLUG_LOCKED',
    'COMPETITION_PUBLIC_PAGE_STALE_WRITE',
    'COMPETITION_ARTICLE_NOT_DRAFT',
    'COMPETITION_ARTICLE_INVALID_TRANSITION',
    'COMPETITION_ARTICLE_DELETE_FORBIDDEN',
    'COMPETITION_ARTICLE_STALE_WRITE',
    'COMPETITION_AWARD_RULE_VERSION_NOT_DRAFT',
    'GOLDEN_BOARD_CONFIG_SOURCE_REQUIRED',
    'GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE',
  ].includes(code)) return errorResponse(code, 409);
  const safeCode = code.startsWith('COMPETITION_') || code.startsWith('GOLDEN_BOARD_')
    ? code
    : 'COMPETITION_PORTAL_REQUEST_FAILED';
  return errorResponse(safeCode, 400);
}

function invalidPayload(message: string): Response {
  return errorResponse(message, 400);
}

export async function handleCompetitionPortalRoutes(
  request: Request,
  db: D1Database,
  path: string,
  method: string,
  user: JWTPayload,
  teacherClassIds: string[] | undefined,
): Promise<Response | null> {
  const resource = parsePortalResource(path);
  if (!resource) return null;
  if (!await canAccessCampaign(db, resource.campaignId, user, teacherClassIds)) {
    return errorResponse('COMPETITION_CAMPAIGN_NOT_FOUND', 404);
  }

  try {
    if (resource.kind === 'public-page') {
      if (!resource.action && method === 'GET') {
        return jsonResponse({ publicPage: await getPublicPageForStaff(db, resource.campaignId) });
      }
      if (!resource.action && method === 'PUT') {
        const body = await jsonBody(request);
        const parsed = UpdateCompetitionPublicPageRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition public page payload');
        const publicPage = await updatePublicPageDraft(db, resource.campaignId, parsed.data, user.username);
        return jsonResponse({ publicPage });
      }
      if (resource.action && method === 'POST') {
        const body = await jsonBody(request);
        const parsed = ActivateCompetitionAwardRuleVersionRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition public page action payload');
        const service = resource.action === 'preview'
          ? previewPublicPage
          : resource.action === 'publish' ? publishPublicPage : archivePublicPage;
        const publicPage = await service(db, resource.campaignId, user.username, parsed.data.requestId);
        return jsonResponse(resource.action === 'preview' ? { preview: publicPage } : { publicPage });
      }
    }

    if (resource.kind === 'articles') {
      if (!resource.articleId && method === 'GET') {
        return jsonResponse({ items: await listCompetitionArticlesForStaff(db, resource.campaignId) });
      }
      if (resource.articleId && method === 'GET') {
        return jsonResponse({ article: await getCompetitionArticleForStaff(db, resource.campaignId, resource.articleId) });
      }
      if (!resource.articleId && method === 'POST') {
        const body = await jsonBody(request);
        const parsed = CreateCompetitionArticleRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition article payload');
        if (parsed.data.campaignId !== resource.campaignId) {
          return invalidPayload('COMPETITION_CAMPAIGN_ROUTE_MISMATCH');
        }
        const article = await createCompetitionArticle(db, parsed.data, user.username);
        return jsonResponse({ article }, 201);
      }
      if (resource.articleId && method === 'PATCH') {
        const body = await jsonBody(request);
        const parsed = UpdateCompetitionArticleRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition article payload');
        const article = await updateCompetitionArticle(
          db, resource.campaignId, resource.articleId, parsed.data, user.username,
        );
        return jsonResponse({ article });
      }
      if (resource.articleId && method === 'DELETE') {
        const parsed = ActivateCompetitionAwardRuleVersionRequestSchema.safeParse({
          requestId: request.headers.get('x-request-id'),
        });
        if (!parsed.success) return invalidPayload('Invalid competition article delete request');
        const article = await deleteCompetitionArticle(
          db, resource.campaignId, resource.articleId, user.username, parsed.data.requestId,
        );
        return jsonResponse({ article });
      }
    }

    if (resource.kind === 'golden-board-config') {
      if (method === 'GET') {
        return jsonResponse({ goldenBoardConfig: await getGoldenBoardConfig(db, resource.campaignId) });
      }
      if (method === 'PUT') {
        const body = await jsonBody(request);
        const parsed = UpdateCompetitionGoldenBoardConfigRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition Golden Board payload');
        const goldenBoardConfig = await updateGoldenBoardConfig(
          db, resource.campaignId, parsed.data, user.username,
        );
        return jsonResponse({ goldenBoardConfig });
      }
    }

    if (resource.kind === 'award-rules') {
      if (!resource.activate && method === 'GET') {
        return jsonResponse({ items: await listAwardRuleVersions(db, resource.campaignId) });
      }
      if (!resource.activate && method === 'POST') {
        const body = await jsonBody(request);
        const parsed = CreateCompetitionAwardRuleVersionRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition award rules payload');
        if (parsed.data.campaignId !== resource.campaignId) {
          return invalidPayload('COMPETITION_CAMPAIGN_ROUTE_MISMATCH');
        }
        const awardRuleVersion = await createAwardRuleVersion(db, parsed.data, user.username);
        return jsonResponse({ awardRuleVersion }, 201);
      }
      if (resource.activate && method === 'POST') {
        const body = await jsonBody(request);
        const parsed = ActivateCompetitionAwardRuleVersionRequestSchema.safeParse(body);
        if (!parsed.success) return invalidPayload('Invalid competition award rule activation payload');
        const awardRuleVersion = await activateAwardRuleVersion(
          db, resource.campaignId, resource.version!, user.username, parsed.data.requestId,
        );
        return jsonResponse({ awardRuleVersion });
      }
    }
    return null;
  } catch (error) {
    return portalError(error);
  }
}
