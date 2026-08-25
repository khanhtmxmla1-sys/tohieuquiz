import {
  UpdateCompetitionPublicPageRequestSchema,
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
