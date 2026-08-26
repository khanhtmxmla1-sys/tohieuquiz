import {
  PublicCompetitionDetailDtoSchema,
  PublicCompetitionSummaryDtoSchema,
  PublicGoldenBoardDtoSchema,
} from '../../../../schemas/competitionPortal.schema';
import type {
  CompetitionPublicState,
  CompetitionRoundPresentationState,
  PublicCompetitionSummaryDto,
} from '../../../../shared/competition-portal.contract';
import { getPublishedCompetitionArticle, listPublishedCompetitionArticles } from '../../competition/competitionArticleService';
import { getPublicGoldenBoard } from '../../competition/goldenBoardService';
import {
  isCompetitionGoldenBoardEnabled,
  isCompetitionPublicPortalReadEnabled,
} from '../../competition/portalFeatureFlags';
import {
  getPublishedPublicPageProjectionBySlug,
  listPublishedPublicPageProjections,
  type PublishedCompetitionPublicPageProjection,
} from '../../competition/publicPageService';
import type { Env } from '../../types';
import { internalErrorResponse } from '../../utils/internalError';
import type { StructuredLogSink } from '../../utils/logger';

const PUBLIC_PREFIX = '/api/public/competitions';
const CACHE_SECONDS = 60;

interface PublicRoundRow {
  round_number: number;
  opens_at: string;
  closes_at: string;
  status: string;
}

export interface PublicCompetitionRouteOptions {
  now?: () => Date;
  logger?: StructuredLogSink;
}

function notFound(): Response {
  return Response.json({ status: 'error', message: 'Not found' }, { status: 404 });
}

function methodNotAllowed(): Response {
  return Response.json({ status: 'error', message: 'Method not allowed' }, { status: 405 });
}

function decodePathSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded && !decoded.includes('/') ? decoded : null;
  } catch {
    return null;
  }
}

function publicState(startsAt: string, endsAt: string, now: Date): CompetitionPublicState {
  const timestamp = now.getTime();
  if (timestamp < Date.parse(startsAt)) return 'UPCOMING';
  if (timestamp >= Date.parse(endsAt)) return 'ENDED';
  return 'ONGOING';
}

function roundState(row: PublicRoundRow, now: Date): CompetitionRoundPresentationState {
  const timestamp = now.getTime();
  if (timestamp < Date.parse(row.opens_at)) return 'LOCKED';
  if (timestamp >= Date.parse(row.closes_at) || row.status === 'CLOSED') return 'CLOSED';
  return row.status === 'OPEN' ? 'OPEN' : 'LOCKED';
}

async function publicRounds(
  db: D1Database,
  campaignId: string,
  now: Date,
) {
  const result = await db.prepare(`
    SELECT round_number, opens_at, closes_at, status
    FROM competition_rounds
    WHERE campaign_id = ?
    ORDER BY round_number ASC, id ASC
    LIMIT 6
  `).bind(campaignId).all<PublicRoundRow>();
  return (result.results || []).map((row) => ({
    roundNumber: Number(row.round_number),
    title: `Vòng ${Number(row.round_number)}`,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    state: roundState(row, now),
  }));
}

async function toSummary(
  db: D1Database,
  row: PublishedCompetitionPublicPageProjection,
  now: Date,
): Promise<PublicCompetitionSummaryDto> {
  const rounds = await publicRounds(db, row.campaignId, now);
  const candidate = {
    slug: row.slug,
    title: row.title,
    summary: row.summary || row.title,
    schoolYear: row.schoolYear,
    publicState: publicState(row.startsAt, row.endsAt, now),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    hero: {
      title: row.heroTitle,
      ...(row.heroSubtitle ? { subtitle: row.heroSubtitle } : {}),
      ...(row.heroImageUrl ? { imageUrl: row.heroImageUrl } : {}),
    },
    cta: { label: row.ctaLabel },
    rounds,
    articleSummaryAvailable: row.articleSummaryAvailable,
  };
  const parsed = PublicCompetitionSummaryDtoSchema.safeParse(candidate);
  if (!parsed.success) throw new Error('COMPETITION_PUBLIC_PAGE_PROJECTION_INVALID');
  return parsed.data;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validatorHeaders(etag: string, lastModified: string, seconds = CACHE_SECONDS): Headers {
  const headers = new Headers({
    'Cache-Control': `public, max-age=${seconds}, must-revalidate`,
    'Content-Type': 'application/json',
    ETag: etag,
  });
  const parsedLastModified = new Date(lastModified);
  if (!Number.isNaN(parsedLastModified.getTime())) {
    headers.set('Last-Modified', parsedLastModified.toUTCString());
  }
  return headers;
}

function isNotModified(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) return ifNoneMatch.split(',').map((value) => value.trim()).includes(etag);
  // Timestamps cannot identify removals or time-derived state transitions; only the
  // full-representation ETag is strong enough to authorize a public 304 response.
  return false;
}

async function cacheableJson(
  request: Request,
  data: unknown,
  lastModified: string,
  etagIdentity?: string,
  seconds = CACHE_SECONDS,
): Promise<Response> {
  const body = JSON.stringify({ status: 'success', data });
  const representationHash = await sha256(body);
  const etag = `"${etagIdentity ? `${etagIdentity}-${representationHash}` : representationHash}"`;
  const headers = validatorHeaders(etag, lastModified, seconds);
  if (isNotModified(request, etag)) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers });
}

function latestTimestamp(values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1)
    || new Date(0).toISOString();
}

function recognizedPublicPath(path: string): boolean {
  return path === PUBLIC_PREFIX
    || /^\/api\/public\/competitions\/[^/]+$/.test(path)
    || /^\/api\/public\/competitions\/[^/]+\/articles$/.test(path)
    || /^\/api\/public\/competitions\/[^/]+\/articles\/[^/]+$/.test(path)
    || /^\/api\/public\/competitions\/[^/]+\/golden-board$/.test(path);
}

export async function handlePublicCompetitionRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  options: PublicCompetitionRouteOptions = {},
): Promise<Response | null> {
  if (path !== PUBLIC_PREFIX && !path.startsWith(`${PUBLIC_PREFIX}/`)) return null;
  if (!recognizedPublicPath(path)) return notFound();
  if (!await isCompetitionPublicPortalReadEnabled(env.DB)) return notFound();
  if (method !== 'GET') return methodNotAllowed();

  const now = options.now?.() || new Date();
  try {
    if (path === PUBLIC_PREFIX) {
      const rows = await listPublishedPublicPageProjections(env.DB);
      const items: PublicCompetitionSummaryDto[] = [];
      for (const row of rows) {
        items.push(await toSummary(env.DB, row, now));
      }
      return cacheableJson(request, items, latestTimestamp(rows.map((row) => row.updatedAt)));
    }

    const articleMatch = path.match(/^\/api\/public\/competitions\/([^/]+)\/articles\/([^/]+)$/);
    if (articleMatch) {
      const slug = decodePathSegment(articleMatch[1]);
      const articleSlug = decodePathSegment(articleMatch[2]);
      if (!slug || !articleSlug) return notFound();
      const article = await getPublishedCompetitionArticle(env.DB, slug, articleSlug);
      if (!article) return notFound();
      return cacheableJson(request, article, article.publishedAt);
    }

    const articlesMatch = path.match(/^\/api\/public\/competitions\/([^/]+)\/articles$/);
    if (articlesMatch) {
      const slug = decodePathSegment(articlesMatch[1]);
      if (!slug || !await getPublishedPublicPageProjectionBySlug(env.DB, slug)) return notFound();
      const articles = await listPublishedCompetitionArticles(env.DB, slug);
      return cacheableJson(
        request,
        articles,
        latestTimestamp(articles.map((article) => article.publishedAt)),
      );
    }

    const goldenBoardMatch = path.match(/^\/api\/public\/competitions\/([^/]+)\/golden-board$/);
    if (goldenBoardMatch) {
      if (!await isCompetitionGoldenBoardEnabled(env.DB)) return notFound();
      const slug = decodePathSegment(goldenBoardMatch[1]);
      if (!slug) return notFound();
      const page = await getPublishedPublicPageProjectionBySlug(env.DB, slug);
      if (!page) return notFound();
      const board = PublicGoldenBoardDtoSchema.parse(await getPublicGoldenBoard(env.DB, page.campaignId));
      const identity = `golden-board-${encodeURIComponent(slug)}-${board.publicationVersion}-${board.rankingVersion}-${board.awardRuleVersion}`;
      return cacheableJson(request, board, board.publishedAt, identity, 30);
    }

    const detailMatch = path.match(/^\/api\/public\/competitions\/([^/]+)$/);
    if (detailMatch) {
      const slug = decodePathSegment(detailMatch[1]);
      if (!slug) return notFound();
      const page = await getPublishedPublicPageProjectionBySlug(env.DB, slug);
      if (!page) return notFound();
      const summary = await toSummary(env.DB, page, now);
      const articles = await listPublishedCompetitionArticles(env.DB, slug);
      const parsed = PublicCompetitionDetailDtoSchema.safeParse({ ...summary, articles });
      if (!parsed.success) throw new Error('COMPETITION_PUBLIC_PAGE_PROJECTION_INVALID');
      return cacheableJson(
        request,
        parsed.data,
        latestTimestamp([page.updatedAt, ...articles.map((article) => article.publishedAt)]),
      );
    }
  } catch (error) {
    return internalErrorResponse(error, request, {
      context: 'Competition public API',
      logger: options.logger,
    });
  }
  return null;
}
