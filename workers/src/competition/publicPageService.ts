import {
  CreateCompetitionPublicPageRequestSchema,
  UpdateCompetitionPublicPageRequestSchema,
  type CreateCompetitionPublicPageRequest,
  type UpdateCompetitionPublicPageRequest,
} from '../../../schemas/competitionPortal.schema';
import type {
  CompetitionPublicPageStatus,
  StaffCompetitionPublicPageDto,
} from '../../../shared/competition-portal.contract';
import { auditStatement } from '../utils/audit';

interface CompetitionPublicPageRow {
  id: string;
  campaign_id: string;
  slug: string;
  status: CompetitionPublicPageStatus;
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  summary: string | null;
  cta_label: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface PublishedCompetitionPublicPageDto {
  slug: string;
  heroTitle: string;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  summary: string | null;
  ctaLabel: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  publishedAt: string;
}

export interface PublishedCompetitionPublicPageProjection {
  campaignId: string;
  slug: string;
  heroTitle: string;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  summary: string | null;
  ctaLabel: string;
  publishedAt: string;
  updatedAt: string;
  title: string;
  schoolYear: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  articleSummaryAvailable: boolean;
  goldenBoardAvailable: boolean;
}

interface PublishedCompetitionPublicPageProjectionRow {
  campaign_id: string;
  slug: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  summary: string | null;
  cta_label: string;
  published_at: string;
  updated_at: string;
  title: string;
  school_year: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  article_summary_available: number;
  golden_board_available: number;
}

const PUBLISHED_PROJECTION_COLUMNS = `
  page.campaign_id, page.slug, page.hero_title, page.hero_subtitle,
  page.hero_image_url, page.summary, page.cta_label, page.published_at,
  page.updated_at, campaign.title, campaign.school_year, campaign.timezone,
  campaign.starts_at, campaign.ends_at,
  EXISTS (
    SELECT 1 FROM competition_articles AS article
    WHERE article.campaign_id = page.campaign_id
      AND article.status = 'PUBLISHED' AND article.published_at IS NOT NULL
  ) AS article_summary_available
  , EXISTS (
    SELECT 1 FROM competition_golden_board_configs AS golden_board
    WHERE golden_board.campaign_id = page.campaign_id
      AND golden_board.enabled = 1
  ) AS golden_board_available
`;

function mapPublishedProjection(
  row: PublishedCompetitionPublicPageProjectionRow,
): PublishedCompetitionPublicPageProjection {
  return {
    campaignId: row.campaign_id,
    slug: row.slug,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroImageUrl: row.hero_image_url,
    summary: row.summary,
    ctaLabel: row.cta_label,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    title: row.title,
    schoolYear: row.school_year,
    timezone: row.timezone,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    articleSummaryAvailable: Boolean(row.article_summary_available),
    goldenBoardAvailable: Boolean(row.golden_board_available),
  };
}

export async function listPublishedPublicPageProjections(
  db: D1Database,
  options: {
    limit?: number;
    offset?: number;
    requireCompleteRounds?: boolean;
    requireStructurallyValid?: boolean;
  } = {},
): Promise<PublishedCompetitionPublicPageProjection[]> {
  const limit = Number.isInteger(options.limit) && options.limit! > 0
    ? Math.min(options.limit!, 100)
    : 100;
  const offset = Number.isInteger(options.offset) && options.offset! >= 0
    ? options.offset!
    : 0;
  // The public collection uses these predicates before LIMIT so incomplete or
  // obviously malformed rows cannot consume the entire bounded page.
  // The round count stays correlated to each public candidate so the
  // campaign-leading round index can answer it without a global aggregation.
  const completeRoundsPredicate = options.requireCompleteRounds
    ? `
    AND (
      SELECT COUNT(*)
      FROM competition_rounds AS complete_round
      WHERE complete_round.campaign_id = page.campaign_id
    ) = 6
  `
    : '';
  const structuralWhere = options.requireStructurallyValid
    ? `
      AND length(trim(page.slug)) BETWEEN 1 AND 160
      AND length(trim(page.hero_title)) BETWEEN 1 AND 200
      AND (
        page.hero_subtitle IS NULL
        OR page.hero_subtitle = ''
        OR (length(trim(page.hero_subtitle)) BETWEEN 1 AND 500 AND trim(page.hero_subtitle) <> '')
      )
      AND (
        page.hero_image_url IS NULL
        OR page.hero_image_url = ''
        OR (
          length(trim(page.hero_image_url)) BETWEEN 1 AND 2048
          AND instr(trim(page.hero_image_url), ':') > 0
        )
      )
      AND (
        page.summary IS NULL
        OR page.summary = ''
        OR (length(trim(page.summary)) BETWEEN 1 AND 1000 AND trim(page.summary) <> '')
      )
      AND length(trim(page.cta_label)) BETWEEN 1 AND 80
      AND length(trim(campaign.title)) BETWEEN 1 AND 200
      AND length(trim(campaign.school_year)) = 9
      AND substr(trim(campaign.school_year), 5, 1) = '-'
      AND trim(campaign.school_year) NOT GLOB '*[^0-9-]*'
      AND length(trim(campaign.timezone)) BETWEEN 1 AND 100
      AND length(trim(campaign.starts_at)) > 0
      AND length(trim(campaign.ends_at)) > 0
    `
    : '';
  const result = await db.prepare(`
    SELECT ${PUBLISHED_PROJECTION_COLUMNS}
    FROM competition_public_pages AS page
    INNER JOIN competition_campaigns AS campaign ON campaign.id = page.campaign_id
    WHERE page.status = 'PUBLISHED' AND page.published_at IS NOT NULL
      ${completeRoundsPredicate}
      ${structuralWhere}
    ORDER BY page.published_at DESC, page.slug ASC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<PublishedCompetitionPublicPageProjectionRow>();
  return (result.results || []).map(mapPublishedProjection);
}

export async function getPublishedPublicPageProjectionBySlug(
  db: D1Database,
  slugInput: string,
): Promise<PublishedCompetitionPublicPageProjection | null> {
  const slug = String(slugInput || '').trim();
  if (!slug) return null;
  const row = await db.prepare(`
    SELECT ${PUBLISHED_PROJECTION_COLUMNS}
    FROM competition_public_pages AS page
    INNER JOIN competition_campaigns AS campaign ON campaign.id = page.campaign_id
    WHERE page.slug = ? AND page.status = 'PUBLISHED' AND page.published_at IS NOT NULL
    LIMIT 1
  `).bind(slug).first<PublishedCompetitionPublicPageProjectionRow>();
  return row ? mapPublishedProjection(row) : null;
}

const PAGE_COLUMNS = `
  id, campaign_id, slug, status, hero_title, hero_subtitle, hero_image_url,
  summary, cta_label, seo_title, seo_description, og_image_url,
  published_at, archived_at, created_by, created_at, updated_by, updated_at
`;

function normalizedId(value: unknown, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function mapPublicPage(row: CompetitionPublicPageRow): StaffCompetitionPublicPageDto {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    slug: row.slug,
    status: row.status,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroImageUrl: row.hero_image_url,
    summary: row.summary,
    ctaLabel: row.cta_label,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    ogImageUrl: row.og_image_url,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function mapPublishedPublicPage(row: CompetitionPublicPageRow): PublishedCompetitionPublicPageDto {
  return {
    slug: row.slug,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroImageUrl: row.hero_image_url,
    summary: row.summary,
    ctaLabel: row.cta_label,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    ogImageUrl: row.og_image_url,
    publishedAt: row.published_at!,
  };
}

function auditMetadata(row: CompetitionPublicPageRow) {
  return {
    status: row.status,
    slug: row.slug,
    heroTitle: row.hero_title,
    ctaLabel: row.cta_label,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}

const SNAPSHOT_MATCH = `
  id = ? AND campaign_id = ? AND status = ?
  AND slug = ? AND hero_title = ? AND hero_subtitle IS ? AND hero_image_url IS ?
  AND summary IS ? AND cta_label = ? AND seo_title IS ? AND seo_description IS ?
  AND og_image_url IS ? AND published_at IS ? AND archived_at IS ?
  AND updated_by IS ? AND updated_at = ?
`;

function snapshotBindings(row: CompetitionPublicPageRow): unknown[] {
  return [
    row.id,
    row.campaign_id,
    row.status,
    row.slug,
    row.hero_title,
    row.hero_subtitle,
    row.hero_image_url,
    row.summary,
    row.cta_label,
    row.seo_title,
    row.seo_description,
    row.og_image_url,
    row.published_at,
    row.archived_at,
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
    SELECT ?, NULL, 'COMPETITION_PUBLIC_PAGE_STALE_GUARD',
      'competition_public_page', ?, ?, NULL, NULL, ?
    WHERE changes() <> 1
  `).bind(
    `audit-guard-${crypto.randomUUID()}`,
    targetId,
    requestId,
    new Date().toISOString(),
  );
}

function rethrowBatchError(error: unknown): never {
  if (String(error).includes('admin_audit_logs.actor_username')) {
    throw new Error('COMPETITION_PUBLIC_PAGE_STALE_WRITE');
  }
  if (
    String(error).includes('UNIQUE')
    && String(error).includes('competition_public_pages')
  ) {
    throw new Error('COMPETITION_PUBLIC_PAGE_CONFLICT');
  }
  throw error;
}

async function getPublicPageRowByCampaign(
  db: D1Database,
  campaignId: string,
): Promise<CompetitionPublicPageRow | null> {
  return db.prepare(`
    SELECT ${PAGE_COLUMNS}
    FROM competition_public_pages
    WHERE campaign_id = ?
    LIMIT 1
  `).bind(campaignId).first<CompetitionPublicPageRow>();
}

async function getPublicPageRowBySlug(
  db: D1Database,
  slug: string,
): Promise<CompetitionPublicPageRow | null> {
  return db.prepare(`
    SELECT ${PAGE_COLUMNS}
    FROM competition_public_pages
    WHERE slug = ? AND status = 'PUBLISHED'
    LIMIT 1
  `).bind(slug).first<CompetitionPublicPageRow>();
}

export async function getPublicPageForStaff(
  db: D1Database,
  campaignIdInput: string,
): Promise<StaffCompetitionPublicPageDto | null> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const row = await getPublicPageRowByCampaign(db, campaignId);
  return row ? mapPublicPage(row) : null;
}

export async function createPublicPageDraft(
  db: D1Database,
  campaignIdInput: string,
  input: CreateCompetitionPublicPageRequest,
  actorUsername: string,
): Promise<StaffCompetitionPublicPageDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = CreateCompetitionPublicPageRequestSchema.parse(input);

  const campaign = await db.prepare(`
    SELECT id FROM competition_campaigns WHERE id = ? LIMIT 1
  `).bind(campaignId).first<{ id: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');

  const existing = await getPublicPageRowByCampaign(db, campaignId);
  if (existing) throw new Error('COMPETITION_PUBLIC_PAGE_CONFLICT');

  const now = new Date().toISOString();
  const row: CompetitionPublicPageRow = {
    id: `competition-public-page-${crypto.randomUUID()}`,
    campaign_id: campaignId,
    slug: parsed.slug,
    status: 'DRAFT',
    hero_title: parsed.heroTitle,
    hero_subtitle: parsed.heroSubtitle ?? null,
    hero_image_url: parsed.heroImageUrl ?? null,
    summary: parsed.summary ?? null,
    cta_label: parsed.ctaLabel ?? 'VÀO THI',
    seo_title: parsed.seoTitle ?? null,
    seo_description: parsed.seoDescription ?? null,
    og_image_url: parsed.ogImageUrl ?? null,
    published_at: null,
    archived_at: null,
    created_by: actor,
    created_at: now,
    updated_by: null,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO competition_public_pages (
          id, campaign_id, slug, status, hero_title, hero_subtitle, hero_image_url,
          summary, cta_label, seo_title, seo_description, og_image_url,
          published_at, archived_at, created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?)
      `).bind(
        row.id,
        row.campaign_id,
        row.slug,
        row.hero_title,
        row.hero_subtitle,
        row.hero_image_url,
        row.summary,
        row.cta_label,
        row.seo_title,
        row.seo_description,
        row.og_image_url,
        row.created_by,
        row.created_at,
        row.updated_at,
      ),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_PUBLIC_PAGE_CREATED',
        targetType: 'competition_public_page',
        targetId: row.id,
        requestId: parsed.requestId,
        after: auditMetadata(row),
      }),
    ]);
  } catch (error) {
    rethrowBatchError(error);
  }

  return mapPublicPage(row);
}

export async function updatePublicPageDraft(
  db: D1Database,
  campaignIdInput: string,
  input: UpdateCompetitionPublicPageRequest,
  actorUsername: string,
): Promise<StaffCompetitionPublicPageDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = UpdateCompetitionPublicPageRequestSchema.parse(input);
  if (parsed.status !== undefined) throw new Error('COMPETITION_PUBLIC_PAGE_STATUS_MANAGED');

  const before = await getPublicPageRowByCampaign(db, campaignId);
  if (!before) throw new Error('COMPETITION_PUBLIC_PAGE_NOT_FOUND');
  if (parsed.slug !== undefined && parsed.slug !== before.slug && before.published_at !== null) {
    throw new Error('COMPETITION_PUBLIC_PAGE_SLUG_LOCKED');
  }
  if (before.status !== 'DRAFT') throw new Error('COMPETITION_PUBLIC_PAGE_NOT_DRAFT');

  const now = new Date().toISOString();
  const merged = {
    slug: parsed.slug ?? before.slug,
    heroTitle: parsed.heroTitle ?? before.hero_title,
    heroSubtitle: parsed.heroSubtitle === undefined ? before.hero_subtitle : parsed.heroSubtitle,
    heroImageUrl: parsed.heroImageUrl === undefined ? before.hero_image_url : parsed.heroImageUrl,
    summary: parsed.summary === undefined ? before.summary : parsed.summary,
    ctaLabel: parsed.ctaLabel ?? before.cta_label,
    seoTitle: parsed.seoTitle === undefined ? before.seo_title : parsed.seoTitle,
    seoDescription: parsed.seoDescription === undefined ? before.seo_description : parsed.seoDescription,
    ogImageUrl: parsed.ogImageUrl === undefined ? before.og_image_url : parsed.ogImageUrl,
  };
  const afterForAudit: CompetitionPublicPageRow = {
    ...before,
    slug: merged.slug,
    hero_title: merged.heroTitle,
    hero_subtitle: merged.heroSubtitle,
    hero_image_url: merged.heroImageUrl,
    summary: merged.summary,
    cta_label: merged.ctaLabel,
    seo_title: merged.seoTitle,
    seo_description: merged.seoDescription,
    og_image_url: merged.ogImageUrl,
    updated_by: actor,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_public_pages
        SET slug = ?, hero_title = ?, hero_subtitle = ?, hero_image_url = ?, summary = ?,
            cta_label = ?, seo_title = ?, seo_description = ?, og_image_url = ?,
            updated_by = ?, updated_at = ?
        WHERE ${SNAPSHOT_MATCH}
      `).bind(
        merged.slug,
        merged.heroTitle,
        merged.heroSubtitle,
        merged.heroImageUrl,
        merged.summary,
        merged.ctaLabel,
        merged.seoTitle,
        merged.seoDescription,
        merged.ogImageUrl,
        actor,
        now,
        ...snapshotBindings(before),
      ),
      staleMutationGuardStatement(db, before.id, parsed.requestId),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_PUBLIC_PAGE_UPDATED',
        targetType: 'competition_public_page',
        targetId: before.id,
        requestId: parsed.requestId,
        before: auditMetadata(before),
        after: auditMetadata(afterForAudit),
      }),
    ]);
  } catch (error) {
    rethrowBatchError(error);
  }

  return mapPublicPage(afterForAudit);
}

interface TransitionOptions {
  expectedStatus: CompetitionPublicPageStatus;
  nextStatus: CompetitionPublicPageStatus;
  action: string;
  setPublishedAt?: boolean;
  setArchivedAt?: boolean;
}

async function transitionPublicPage(
  db: D1Database,
  campaignIdInput: string,
  actorUsername: string,
  requestIdInput: string,
  options: TransitionOptions,
): Promise<StaffCompetitionPublicPageDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(requestIdInput, 'COMPETITION_REQUEST_ID_REQUIRED');
  const before = await getPublicPageRowByCampaign(db, campaignId);
  if (!before) throw new Error('COMPETITION_PUBLIC_PAGE_NOT_FOUND');
  if (before.status !== options.expectedStatus) {
    throw new Error('COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION');
  }

  const now = new Date().toISOString();
  const publishedAt = options.setPublishedAt ? (before.published_at ?? now) : before.published_at;
  const archivedAt = options.setArchivedAt ? now : before.archived_at;
  const afterForAudit: CompetitionPublicPageRow = {
    ...before,
    status: options.nextStatus,
    published_at: publishedAt,
    archived_at: archivedAt,
    updated_by: actor,
    updated_at: now,
  };

  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_public_pages
        SET status = ?, published_at = ?, archived_at = ?, updated_by = ?, updated_at = ?
        WHERE ${SNAPSHOT_MATCH}
      `).bind(
        options.nextStatus,
        publishedAt,
        archivedAt,
        actor,
        now,
        ...snapshotBindings(before),
      ),
      staleMutationGuardStatement(db, before.id, requestId),
      auditStatement(db, {
        actorUsername: actor,
        action: options.action,
        targetType: 'competition_public_page',
        targetId: before.id,
        requestId,
        before: auditMetadata(before),
        after: auditMetadata(afterForAudit),
      }),
    ]);
  } catch (error) {
    rethrowBatchError(error);
  }

  return mapPublicPage(afterForAudit);
}

export async function previewPublicPage(
  db: D1Database,
  campaignId: string,
  actorUsername: string,
  requestId: string,
): Promise<StaffCompetitionPublicPageDto> {
  return transitionPublicPage(db, campaignId, actorUsername, requestId, {
    expectedStatus: 'DRAFT',
    nextStatus: 'PREVIEW',
    action: 'COMPETITION_PUBLIC_PAGE_PREVIEWED',
  });
}

export async function publishPublicPage(
  db: D1Database,
  campaignId: string,
  actorUsername: string,
  requestId: string,
): Promise<StaffCompetitionPublicPageDto> {
  return transitionPublicPage(db, campaignId, actorUsername, requestId, {
    expectedStatus: 'PREVIEW',
    nextStatus: 'PUBLISHED',
    action: 'COMPETITION_PUBLIC_PAGE_PUBLISHED',
    setPublishedAt: true,
  });
}

export async function archivePublicPage(
  db: D1Database,
  campaignId: string,
  actorUsername: string,
  requestId: string,
): Promise<StaffCompetitionPublicPageDto> {
  return transitionPublicPage(db, campaignId, actorUsername, requestId, {
    expectedStatus: 'PUBLISHED',
    nextStatus: 'ARCHIVED',
    action: 'COMPETITION_PUBLIC_PAGE_ARCHIVED',
    setArchivedAt: true,
  });
}

export async function getPublishedPublicPageBySlug(
  db: D1Database,
  slugInput: string,
): Promise<PublishedCompetitionPublicPageDto | null> {
  const slug = String(slugInput || '').trim();
  if (!slug) return null;
  const row = await getPublicPageRowBySlug(db, slug);
  return row ? mapPublishedPublicPage(row) : null;
}
