import {
  CreateCompetitionArticleRequestSchema,
  PublicCompetitionArticleDtoSchema,
  UpdateCompetitionArticleRequestSchema,
  type CreateCompetitionArticleRequest,
  type UpdateCompetitionArticleRequest,
} from '../../../schemas/competitionPortal.schema';
import type {
  CompetitionArticleStatus,
  CompetitionArticleType,
  PublicCompetitionArticleDto,
  StaffCompetitionArticleDto,
} from '../../../shared/competition-portal.contract';
import { auditStatement } from '../utils/audit';

interface CompetitionArticleRow {
  id: string;
  campaign_id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover_image_url: string | null;
  content: string;
  type: CompetitionArticleType;
  status: CompetitionArticleStatus;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

const ARTICLE_COLUMNS = `
  id, campaign_id, title, slug, summary, cover_image_url, content, type, status,
  published_at, created_by, created_at, updated_by, updated_at
`;

function normalizedId(value: unknown, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function mapStaffArticle(row: CompetitionArticleRow): StaffCompetitionArticleDto {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    coverImageUrl: row.cover_image_url,
    content: row.content,
    type: row.type,
    status: row.status,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  } as StaffCompetitionArticleDto;
}

function parsePublishedArticle(row: CompetitionArticleRow): PublicCompetitionArticleDto | null {
  const parsed = PublicCompetitionArticleDtoSchema.safeParse({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverImageUrl: row.cover_image_url ?? undefined,
    content: row.content,
    type: row.type,
    publishedAt: row.published_at,
  });
  return parsed.success ? parsed.data : null;
}

function auditMetadata(row: CompetitionArticleRow) {
  return {
    status: row.status,
    slug: row.slug,
    type: row.type,
    publishedAt: row.published_at,
    summaryLength: row.summary?.length ?? 0,
    contentLength: row.content.length,
  };
}

const SNAPSHOT_MATCH = `
  id = ? AND campaign_id = ? AND title = ? AND slug = ?
  AND summary IS ? AND cover_image_url IS ? AND content = ? AND type = ?
  AND status = ? AND published_at IS ?
  AND created_by = ? AND created_at = ? AND updated_by IS ? AND updated_at = ?
`;

function snapshotBindings(row: CompetitionArticleRow): unknown[] {
  return [
    row.id,
    row.campaign_id,
    row.title,
    row.slug,
    row.summary,
    row.cover_image_url,
    row.content,
    row.type,
    row.status,
    row.published_at,
    row.created_by,
    row.created_at,
    row.updated_by,
    row.updated_at,
  ];
}

function staleMutationGuardStatement(
  db: D1Database,
  targetId: string,
  requestId: string,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO admin_audit_logs (
      id, actor_username, action, target_type, target_id, request_id,
      before_json, after_json, created_at
    )
    SELECT ?, NULL, 'COMPETITION_ARTICLE_STALE_GUARD',
      'competition_article', ?, ?, NULL, NULL, ?
    WHERE changes() <> 1
  `).bind(
    `audit-guard-${crypto.randomUUID()}`,
    targetId,
    requestId,
    new Date().toISOString(),
  );
}

function rethrowMutationError(error: unknown): never {
  const message = String(error);
  if (message.includes('admin_audit_logs.actor_username')) {
    throw new Error('COMPETITION_ARTICLE_STALE_WRITE');
  }
  if (
    message.includes('UNIQUE')
    && message.includes('competition_articles')
    && (message.includes('campaign_id') || message.includes('slug'))
  ) {
    throw new Error('COMPETITION_ARTICLE_SLUG_CONFLICT');
  }
  throw error;
}

async function getArticleRow(
  db: D1Database,
  campaignId: string,
  articleId: string,
): Promise<CompetitionArticleRow | null> {
  return db.prepare(`
    SELECT ${ARTICLE_COLUMNS}
    FROM competition_articles
    WHERE campaign_id = ? AND id = ?
    LIMIT 1
  `).bind(campaignId, articleId).first<CompetitionArticleRow>();
}

async function requireArticleRow(
  db: D1Database,
  campaignId: string,
  articleId: string,
): Promise<CompetitionArticleRow> {
  const row = await getArticleRow(db, campaignId, articleId);
  if (!row) throw new Error('COMPETITION_ARTICLE_NOT_FOUND');
  return row;
}

export async function listCompetitionArticlesForStaff(
  db: D1Database,
  campaignIdInput: string,
): Promise<StaffCompetitionArticleDto[]> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const result = await db.prepare(`
    SELECT ${ARTICLE_COLUMNS}
    FROM competition_articles
    WHERE campaign_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(campaignId).all<CompetitionArticleRow>();
  return result.results.map(mapStaffArticle);
}

export async function getCompetitionArticleForStaff(
  db: D1Database,
  campaignIdInput: string,
  articleIdInput: string,
): Promise<StaffCompetitionArticleDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const articleId = normalizedId(articleIdInput, 'COMPETITION_ARTICLE_ID_REQUIRED');
  return mapStaffArticle(await requireArticleRow(db, campaignId, articleId));
}

export async function createCompetitionArticle(
  db: D1Database,
  input: CreateCompetitionArticleRequest,
  actorUsername: string,
): Promise<StaffCompetitionArticleDto> {
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = CreateCompetitionArticleRequestSchema.parse(input);
  if (parsed.status !== undefined && parsed.status !== 'DRAFT') {
    throw new Error('COMPETITION_ARTICLE_STATUS_MANAGED');
  }

  const now = new Date().toISOString();
  const row: CompetitionArticleRow = {
    id: `competition-article-${crypto.randomUUID()}`,
    campaign_id: parsed.campaignId,
    title: parsed.title,
    slug: parsed.slug,
    summary: parsed.summary ?? null,
    cover_image_url: parsed.coverImageUrl ?? null,
    content: parsed.content,
    type: parsed.type,
    status: 'DRAFT',
    published_at: null,
    created_by: actor,
    created_at: now,
    updated_by: null,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO competition_articles (
          id, campaign_id, title, slug, summary, cover_image_url, content, type, status,
          published_at, created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', NULL, ?, ?, NULL, ?)
      `).bind(
        row.id,
        row.campaign_id,
        row.title,
        row.slug,
        row.summary,
        row.cover_image_url,
        row.content,
        row.type,
        row.created_by,
        row.created_at,
        row.updated_at,
      ),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_ARTICLE_CREATED',
        targetType: 'competition_article',
        targetId: row.id,
        requestId: parsed.requestId,
        after: auditMetadata(row),
      }),
    ]);
  } catch (error) {
    rethrowMutationError(error);
  }

  return mapStaffArticle(row);
}

export async function updateCompetitionArticle(
  db: D1Database,
  campaignIdInput: string,
  articleIdInput: string,
  input: UpdateCompetitionArticleRequest,
  actorUsername: string,
): Promise<StaffCompetitionArticleDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const articleId = normalizedId(articleIdInput, 'COMPETITION_ARTICLE_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = UpdateCompetitionArticleRequestSchema.parse(input);
  if (parsed.status !== undefined) throw new Error('COMPETITION_ARTICLE_STATUS_MANAGED');

  const before = await requireArticleRow(db, campaignId, articleId);
  if (before.status !== 'DRAFT') throw new Error('COMPETITION_ARTICLE_NOT_DRAFT');

  const now = new Date().toISOString();
  const after: CompetitionArticleRow = {
    ...before,
    title: parsed.title ?? before.title,
    slug: parsed.slug ?? before.slug,
    summary: parsed.summary === undefined ? before.summary : parsed.summary,
    cover_image_url: parsed.coverImageUrl === undefined ? before.cover_image_url : parsed.coverImageUrl,
    content: parsed.content ?? before.content,
    type: parsed.type ?? before.type,
    updated_by: actor,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_articles
        SET title = ?, slug = ?, summary = ?, cover_image_url = ?, content = ?, type = ?,
            updated_by = ?, updated_at = ?
        WHERE ${SNAPSHOT_MATCH}
      `).bind(
        after.title,
        after.slug,
        after.summary,
        after.cover_image_url,
        after.content,
        after.type,
        actor,
        now,
        ...snapshotBindings(before),
      ),
      staleMutationGuardStatement(db, before.id, parsed.requestId),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_ARTICLE_UPDATED',
        targetType: 'competition_article',
        targetId: before.id,
        requestId: parsed.requestId,
        before: auditMetadata(before),
        after: auditMetadata(after),
      }),
    ]);
  } catch (error) {
    rethrowMutationError(error);
  }

  return mapStaffArticle(after);
}

interface TransitionOptions {
  expectedStatus: CompetitionArticleStatus;
  nextStatus: CompetitionArticleStatus;
  action: string;
  requestId: string;
  requirePublishReady?: boolean;
}

async function transitionArticle(
  db: D1Database,
  campaignIdInput: string,
  articleIdInput: string,
  actorUsername: string,
  options: TransitionOptions,
): Promise<StaffCompetitionArticleDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const articleId = normalizedId(articleIdInput, 'COMPETITION_ARTICLE_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(options.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const before = await requireArticleRow(db, campaignId, articleId);
  if (before.status !== options.expectedStatus) {
    throw new Error('COMPETITION_ARTICLE_INVALID_TRANSITION');
  }
  const now = new Date().toISOString();
  const publishedAt = options.nextStatus === 'PUBLISHED'
    ? (before.published_at ?? now)
    : before.published_at;
  const after: CompetitionArticleRow = {
    ...before,
    status: options.nextStatus,
    published_at: publishedAt,
    updated_by: actor,
    updated_at: now,
  };
  if (options.requirePublishReady && !parsePublishedArticle(after)) {
    throw new Error('COMPETITION_ARTICLE_NOT_READY');
  }

  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_articles
        SET status = ?, published_at = ?, updated_by = ?, updated_at = ?
        WHERE ${SNAPSHOT_MATCH}
      `).bind(
        after.status,
        after.published_at,
        actor,
        now,
        ...snapshotBindings(before),
      ),
      staleMutationGuardStatement(db, before.id, requestId),
      auditStatement(db, {
        actorUsername: actor,
        action: options.action,
        targetType: 'competition_article',
        targetId: before.id,
        requestId,
        before: auditMetadata(before),
        after: auditMetadata(after),
      }),
    ]);
  } catch (error) {
    rethrowMutationError(error);
  }

  return mapStaffArticle(after);
}

export async function publishCompetitionArticle(
  db: D1Database,
  campaignId: string,
  articleId: string,
  actorUsername: string,
  requestId: string,
): Promise<StaffCompetitionArticleDto> {
  return transitionArticle(db, campaignId, articleId, actorUsername, {
    expectedStatus: 'DRAFT',
    nextStatus: 'PUBLISHED',
    action: 'COMPETITION_ARTICLE_PUBLISHED',
    requestId,
    requirePublishReady: true,
  });
}

export async function archiveCompetitionArticle(
  db: D1Database,
  campaignId: string,
  articleId: string,
  actorUsername: string,
  requestId: string,
): Promise<StaffCompetitionArticleDto> {
  return transitionArticle(db, campaignId, articleId, actorUsername, {
    expectedStatus: 'PUBLISHED',
    nextStatus: 'ARCHIVED',
    action: 'COMPETITION_ARTICLE_ARCHIVED',
    requestId,
  });
}

async function archivePreviouslyPublishedForDelete(
  db: D1Database,
  before: CompetitionArticleRow,
  actor: string,
  requestId: string,
): Promise<StaffCompetitionArticleDto> {
  if (before.status === 'ARCHIVED') throw new Error('COMPETITION_ARTICLE_DELETE_FORBIDDEN');

  const now = new Date().toISOString();
  const after: CompetitionArticleRow = {
    ...before,
    status: 'ARCHIVED',
    updated_by: actor,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_articles
        SET status = 'ARCHIVED', updated_by = ?, updated_at = ?
        WHERE ${SNAPSHOT_MATCH}
      `).bind(actor, now, ...snapshotBindings(before)),
      staleMutationGuardStatement(db, before.id, requestId),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_ARTICLE_ARCHIVED',
        targetType: 'competition_article',
        targetId: before.id,
        requestId,
        before: auditMetadata(before),
        after: auditMetadata(after),
      }),
    ]);
  } catch (error) {
    rethrowMutationError(error);
  }

  return mapStaffArticle(after);
}

export async function deleteCompetitionArticle(
  db: D1Database,
  campaignIdInput: string,
  articleIdInput: string,
  actorUsername: string,
  requestIdInput: string,
): Promise<StaffCompetitionArticleDto | null> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const articleId = normalizedId(articleIdInput, 'COMPETITION_ARTICLE_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(requestIdInput, 'COMPETITION_REQUEST_ID_REQUIRED');
  const before = await requireArticleRow(db, campaignId, articleId);

  if (before.status === 'DRAFT' && before.published_at === null) {
    try {
      await db.batch([
        db.prepare(`
          DELETE FROM competition_articles
          WHERE ${SNAPSHOT_MATCH}
        `).bind(...snapshotBindings(before)),
        staleMutationGuardStatement(db, before.id, requestId),
        auditStatement(db, {
          actorUsername: actor,
          action: 'COMPETITION_ARTICLE_DELETED',
          targetType: 'competition_article',
          targetId: before.id,
          requestId,
          before: auditMetadata(before),
          after: { deleted: true },
        }),
      ]);
    } catch (error) {
      rethrowMutationError(error);
    }
    return null;
  }

  if (before.published_at !== null) {
    return archivePreviouslyPublishedForDelete(db, before, actor, requestId);
  }

  throw new Error('COMPETITION_ARTICLE_DELETE_FORBIDDEN');
}

export async function listPublishedCompetitionArticles(
  db: D1Database,
  campaignSlugInput: string,
): Promise<PublicCompetitionArticleDto[]> {
  const campaignSlug = String(campaignSlugInput || '').trim();
  if (!campaignSlug) return [];

  const result = await db.prepare(`
    SELECT
      a.id, a.campaign_id, a.title, a.slug, a.summary, a.cover_image_url,
      a.content, a.type, a.status, a.published_at,
      a.created_by, a.created_at, a.updated_by, a.updated_at
    FROM competition_articles a
    INNER JOIN competition_public_pages p ON p.campaign_id = a.campaign_id
    WHERE p.slug = ? AND p.status = 'PUBLISHED'
      AND a.status = 'PUBLISHED' AND a.published_at IS NOT NULL
    ORDER BY a.published_at DESC, a.id ASC
    LIMIT 100
  `).bind(campaignSlug).all<CompetitionArticleRow>();

  return result.results
    .map(parsePublishedArticle)
    .filter((article): article is PublicCompetitionArticleDto => article !== null);
}

export async function getPublishedCompetitionArticle(
  db: D1Database,
  campaignSlugInput: string,
  articleSlugInput: string,
): Promise<PublicCompetitionArticleDto | null> {
  const campaignSlug = String(campaignSlugInput || '').trim();
  const articleSlug = String(articleSlugInput || '').trim();
  if (!campaignSlug || !articleSlug) return null;

  const row = await db.prepare(`
    SELECT
      a.id, a.campaign_id, a.title, a.slug, a.summary, a.cover_image_url,
      a.content, a.type, a.status, a.published_at,
      a.created_by, a.created_at, a.updated_by, a.updated_at
    FROM competition_articles a
    INNER JOIN competition_public_pages p ON p.campaign_id = a.campaign_id
    WHERE p.slug = ? AND p.status = 'PUBLISHED'
      AND a.slug = ? AND a.status = 'PUBLISHED' AND a.published_at IS NOT NULL
    LIMIT 1
  `).bind(campaignSlug, articleSlug).first<CompetitionArticleRow>();

  return row ? parsePublishedArticle(row) : null;
}
