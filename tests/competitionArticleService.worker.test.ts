// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveCompetitionArticle,
  createCompetitionArticle,
  deleteCompetitionArticle,
  getCompetitionArticleForStaff,
  getPublishedCompetitionArticle,
  listCompetitionArticlesForStaff,
  listPublishedCompetitionArticles,
  publishCompetitionArticle,
  updateCompetitionArticle,
} from '../workers/src/competition/competitionArticleService';
import {
  archivePublicPage,
  previewPublicPage,
  publishPublicPage,
} from '../workers/src/competition/publicPageService';
import { COMPETITION_ARTICLE_TYPES } from '../shared/competition-portal.contract';
import { createSqliteD1 } from './helpers/sqliteD1';

const EXPECTED_COMPETITION_ARTICLE_TYPES = [
  'ANNOUNCEMENT',
  'GUIDE',
  'RULES',
  'SCHEDULE',
  'RESULT',
  'AWARD',
  'CERTIFICATE',
  'INCIDENT_NOTICE',
] as const satisfies readonly (typeof COMPETITION_ARTICLE_TYPES[number])[];

const portalMigration = readFileSync(
  new URL('../workers/migrations/0079_competition_public_portal.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE competition_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      school_year TEXT NOT NULL,
      timezone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      audience_rule_json TEXT NOT NULL DEFAULT '{}',
      audience_snapshot_id TEXT,
      eligibility_policy_json TEXT NOT NULL DEFAULT '{}',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE competition_school_exam_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      eligibility_snapshot_version INTEGER NOT NULL,
      title TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME',
      exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM',
      capacity_profile_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      UNIQUE (campaign_id, id),
      FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id)
    );

    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
      owner TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function insertCampaign(db: DatabaseSync, id: string, status = 'REGISTRATION'): void {
  db.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, '2026-2027', 'Asia/Ho_Chi_Minh', ?,
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
      'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run(id, `Sân chơi ${id}`, status);
}

function campaignStatus(id: string): string {
  return String((sqlite.prepare(`SELECT status FROM competition_campaigns WHERE id = ?`).get(id) as {
    status: string;
  }).status);
}

function auditRows() {
  return sqlite.prepare(`
    SELECT actor_username, action, target_type, target_id, request_id, before_json, after_json
    FROM admin_audit_logs
    WHERE target_type = 'competition_article'
    ORDER BY created_at ASC, action ASC
  `).all() as Array<{
    actor_username: string;
    action: string;
    target_type: string;
    target_id: string;
    request_id: string;
    before_json: string | null;
    after_json: string | null;
  }>;
}

function interleaveBeforeBatch(action: () => void): D1Database {
  let pending = true;
  return {
    prepare: d1.prepare.bind(d1),
    batch: async <T = unknown>(statements: D1PreparedStatement[]) => {
      if (pending) {
        pending = false;
        action();
      }
      return d1.batch<T>(statements);
    },
  } as D1Database;
}

async function createDraft(
  campaignId: string,
  slug: string,
  requestId: string,
  overrides: Partial<{
    title: string;
    summary: string;
    content: string;
    type: typeof COMPETITION_ARTICLE_TYPES[number];
  }> = {},
) {
  return createCompetitionArticle(d1, {
    campaignId,
    title: overrides.title ?? `Article ${slug}`,
    slug,
    summary: overrides.summary ?? `Summary ${slug}`,
    content: overrides.content ?? `Content ${slug}`,
    type: overrides.type ?? 'ANNOUNCEMENT',
    requestId,
  }, 'admin-editor');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T01:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  insertCampaign(sqlite, 'campaign-a');
  insertCampaign(sqlite, 'campaign-b');
  sqlite.exec(portalMigration);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

describe('CompetitionArticle persistence and publication rules', () => {
  it('supports all eight types, scoped staff reads, and per-campaign slug uniqueness', async () => {
    expect(EXPECTED_COMPETITION_ARTICLE_TYPES).toHaveLength(8);
    expect(COMPETITION_ARTICLE_TYPES).toHaveLength(8);
    expect(new Set(COMPETITION_ARTICLE_TYPES)).toEqual(new Set(EXPECTED_COMPETITION_ARTICLE_TYPES));

    for (const [index, type] of EXPECTED_COMPETITION_ARTICLE_TYPES.entries()) {
      const created = await createCompetitionArticle(d1, {
        campaignId: 'campaign-a',
        title: `Article ${type}`,
        slug: `article-${index + 1}`,
        summary: `Summary ${type}`,
        content: `Content ${type}`,
        type,
        requestId: `req_article_type_${index + 1}_0001`,
      }, 'admin-editor');
      expect(created).toMatchObject({ campaignId: 'campaign-a', type, status: 'DRAFT', publishedAt: null });
    }

    const list = await listCompetitionArticlesForStaff(d1, 'campaign-a');
    expect(list).toHaveLength(8);
    expect(new Set(list.map((article) => article.type))).toEqual(new Set(EXPECTED_COMPETITION_ARTICLE_TYPES));
    expect(campaignStatus('campaign-a')).toBe('REGISTRATION');

    await expect(createCompetitionArticle(d1, {
      campaignId: 'campaign-a',
      title: 'Duplicate slug',
      slug: 'article-1',
      summary: 'Duplicate',
      content: 'Duplicate',
      type: 'GUIDE',
      requestId: 'req_article_duplicate_0001',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_ARTICLE_SLUG_CONFLICT');

    const sameSlugOtherCampaign = await createCompetitionArticle(d1, {
      campaignId: 'campaign-b',
      title: 'Same slug other campaign',
      slug: 'article-1',
      summary: 'Allowed in another campaign',
      content: 'Allowed',
      type: 'GUIDE',
      requestId: 'req_article_other_campaign_0001',
    }, 'admin-editor');
    expect(sameSlugOtherCampaign.campaignId).toBe('campaign-b');

    const first = list[0];
    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', first.id)).toMatchObject({ id: first.id });
    await expect(getCompetitionArticleForStaff(d1, 'campaign-b', first.id))
      .rejects.toThrow('COMPETITION_ARTICLE_NOT_FOUND');
  });

  it('enforces managed lifecycle, publish readiness, first published_at, and core lifecycle independence', async () => {
    const draft = await createCompetitionArticle(d1, {
      campaignId: 'campaign-a',
      title: 'Draft article',
      slug: 'draft-article',
      content: '',
      type: 'RULES',
      requestId: 'req_article_create_0002',
    }, 'admin-editor');

    await expect(createCompetitionArticle(d1, {
      campaignId: 'campaign-a',
      title: 'Cannot create published',
      slug: 'cannot-create-published',
      summary: 'No direct publish',
      content: 'No direct publish',
      type: 'GUIDE',
      status: 'PUBLISHED',
      requestId: 'req_article_bad_create_status_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_ARTICLE_STATUS_MANAGED');

    await expect(publishCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_publish_not_ready_0002',
    )).rejects.toThrow('COMPETITION_ARTICLE_NOT_READY');

    const updated = await updateCompetitionArticle(d1, 'campaign-a', draft.id, {
      summary: 'Public summary',
      content: 'Public content',
      requestId: 'req_article_update_0002',
    }, 'admin-editor');
    expect(updated).toMatchObject({ status: 'DRAFT', summary: 'Public summary', content: 'Public content' });

    await expect(updateCompetitionArticle(d1, 'campaign-a', draft.id, {
      status: 'PUBLISHED',
      requestId: 'req_article_bad_update_status_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_ARTICLE_STATUS_MANAGED');

    vi.setSystemTime(new Date('2026-09-10T02:03:04.000Z'));
    const published = await publishCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_publish_0002',
    );
    expect(published).toMatchObject({ status: 'PUBLISHED', publishedAt: '2026-09-10T02:03:04.000Z' });
    expect(campaignStatus('campaign-a')).toBe('REGISTRATION');

    await expect(updateCompetitionArticle(d1, 'campaign-a', draft.id, {
      title: 'No edit after publish',
      requestId: 'req_article_edit_published_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_ARTICLE_NOT_DRAFT');
    await expect(publishCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_publish_again_0002',
    )).rejects.toThrow('COMPETITION_ARTICLE_INVALID_TRANSITION');

    vi.setSystemTime(new Date('2026-10-10T03:04:05.000Z'));
    const archived = await archiveCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_archive_0002',
    );
    expect(archived).toMatchObject({ status: 'ARCHIVED', publishedAt: '2026-09-10T02:03:04.000Z' });
    expect(campaignStatus('campaign-a')).toBe('REGISTRATION');

    await expect(archiveCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_archive_again_0002',
    )).rejects.toThrow('COMPETITION_ARTICLE_INVALID_TRANSITION');
  });

  it('physically deletes only never-published drafts and archives published content on delete', async () => {
    const draftSummary = 'DELETE-DRAFT-SUMMARY-SECRET';
    const draftContent = `DELETE-DRAFT-CONTENT-SECRET-${'x'.repeat(1500)}`;
    const neverPublished = await createDraft(
      'campaign-a', 'delete-draft', 'req_article_delete_create_0003',
      { summary: draftSummary, content: draftContent },
    );
    const deleted = await deleteCompetitionArticle(
      d1, 'campaign-a', neverPublished.id, 'admin-editor', 'req_article_delete_0003',
    );
    expect(deleted).toBeNull();
    await expect(getCompetitionArticleForStaff(d1, 'campaign-a', neverPublished.id))
      .rejects.toThrow('COMPETITION_ARTICLE_NOT_FOUND');

    const publishedSummary = 'DELETE-PUBLISHED-SUMMARY-SECRET';
    const publishedContent = `DELETE-PUBLISHED-CONTENT-SECRET-${'y'.repeat(1500)}`;
    const wasPublished = await createDraft(
      'campaign-a', 'delete-published', 'req_article_publish_delete_create_0003',
      { summary: publishedSummary, content: publishedContent },
    );
    const published = await publishCompetitionArticle(
      d1, 'campaign-a', wasPublished.id, 'admin-editor', 'req_article_publish_delete_0003',
    );
    const publishedAt = published.publishedAt;
    const archivedInstead = await deleteCompetitionArticle(
      d1, 'campaign-a', wasPublished.id, 'admin-editor', 'req_article_delete_published_0003',
    );
    expect(archivedInstead).toMatchObject({ status: 'ARCHIVED', publishedAt });
    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', wasPublished.id))
      .toMatchObject({ status: 'ARCHIVED', publishedAt });

    const physicalDeleteAudit = auditRows().find((row) => (
      row.target_id === neverPublished.id && row.action === 'COMPETITION_ARTICLE_DELETED'
    ));
    expect(physicalDeleteAudit).toMatchObject({
      actor_username: 'admin-editor',
      request_id: 'req_article_delete_0003',
    });
    expect(JSON.parse(physicalDeleteAudit!.before_json!)).toEqual({
      status: 'DRAFT',
      slug: 'delete-draft',
      type: 'ANNOUNCEMENT',
      publishedAt: null,
      summaryLength: draftSummary.length,
      contentLength: draftContent.length,
    });
    expect(JSON.parse(physicalDeleteAudit!.after_json!)).toEqual({ deleted: true });
    const physicalDeleteJson = `${physicalDeleteAudit!.before_json}${physicalDeleteAudit!.after_json}`;
    expect(physicalDeleteJson).not.toContain(draftSummary);
    expect(physicalDeleteJson).not.toContain(draftContent);

    const archiveDeleteAudit = auditRows().find((row) => (
      row.target_id === wasPublished.id && row.action === 'COMPETITION_ARTICLE_ARCHIVED'
    ));
    expect(archiveDeleteAudit).toMatchObject({
      actor_username: 'admin-editor',
      request_id: 'req_article_delete_published_0003',
    });
    const publishedMetadata = {
      slug: 'delete-published',
      type: 'ANNOUNCEMENT',
      publishedAt,
      summaryLength: publishedSummary.length,
      contentLength: publishedContent.length,
    };
    expect(JSON.parse(archiveDeleteAudit!.before_json!)).toEqual({
      status: 'PUBLISHED',
      ...publishedMetadata,
    });
    expect(JSON.parse(archiveDeleteAudit!.after_json!)).toEqual({
      status: 'ARCHIVED',
      ...publishedMetadata,
    });
    const archiveDeleteJson = `${archiveDeleteAudit!.before_json}${archiveDeleteAudit!.after_json}`;
    expect(archiveDeleteJson).not.toContain(publishedSummary);
    expect(archiveDeleteJson).not.toContain(publishedContent);
  });

  it('exposes only published articles under a published parent page using a strict public DTO allowlist', async () => {
    const publishedArticle = await createDraft(
      'campaign-a', 'shared-public-slug', 'req_article_public_create_a_0004',
      { title: 'Campaign A article', type: 'ANNOUNCEMENT' },
    );
    await publishCompetitionArticle(
      d1, 'campaign-a', publishedArticle.id, 'admin-editor', 'req_article_public_publish_a_0004',
    );

    const draftArticle = await createDraft(
      'campaign-a', 'draft-hidden', 'req_article_public_draft_0004',
      { title: 'Draft hidden' },
    );
    expect(draftArticle.status).toBe('DRAFT');

    const otherCampaign = await createDraft(
      'campaign-b', 'other-campaign-only', 'req_article_public_create_b_0004',
      { title: 'Campaign B article' },
    );
    await publishCompetitionArticle(
      d1, 'campaign-b', otherCampaign.id, 'admin-editor', 'req_article_public_publish_b_0004',
    );

    const pageA = sqlite.prepare(`SELECT slug FROM competition_public_pages WHERE campaign_id = 'campaign-a'`).get() as { slug: string };
    const pageB = sqlite.prepare(`SELECT slug FROM competition_public_pages WHERE campaign_id = 'campaign-b'`).get() as { slug: string };

    expect(await listPublishedCompetitionArticles(d1, pageA.slug)).toEqual([]);
    expect(await getPublishedCompetitionArticle(d1, pageA.slug, publishedArticle.slug)).toBeNull();

    await previewPublicPage(d1, 'campaign-a', 'admin-editor', 'req_public_page_preview_a_0004');
    expect(await listPublishedCompetitionArticles(d1, pageA.slug)).toEqual([]);
    expect(await getPublishedCompetitionArticle(d1, pageA.slug, publishedArticle.slug)).toBeNull();
    await publishPublicPage(d1, 'campaign-a', 'admin-editor', 'req_public_page_publish_a_0004');

    const publicList = await listPublishedCompetitionArticles(d1, pageA.slug);
    expect(publicList).toHaveLength(1);
    expect(publicList[0]).toMatchObject({
      slug: 'shared-public-slug',
      title: 'Campaign A article',
      type: 'ANNOUNCEMENT',
    });
    expect(Object.keys(publicList[0]).sort()).toEqual([
      'content', 'coverImageUrl', 'publishedAt', 'slug', 'summary', 'title', 'type',
    ].sort());
    for (const forbidden of [
      'id', 'campaignId', 'status', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
    ]) {
      expect(publicList[0]).not.toHaveProperty(forbidden);
    }

    expect(await getPublishedCompetitionArticle(d1, pageA.slug, 'other-campaign-only')).toBeNull();
    expect(await getPublishedCompetitionArticle(d1, pageB.slug, 'other-campaign-only')).toBeNull();

    await archiveCompetitionArticle(
      d1, 'campaign-a', publishedArticle.id, 'admin-editor', 'req_article_public_archive_a_0004',
    );
    expect(await getPublishedCompetitionArticle(d1, pageA.slug, publishedArticle.slug)).toBeNull();

    const visibleUntilParentArchive = await createDraft(
      'campaign-a', 'parent-archive-hidden', 'req_article_parent_archive_create_0004',
      { title: 'Visible before parent archive' },
    );
    await publishCompetitionArticle(
      d1, 'campaign-a', visibleUntilParentArchive.id, 'admin-editor', 'req_article_parent_archive_publish_0004',
    );
    expect(await listPublishedCompetitionArticles(d1, pageA.slug)).toHaveLength(1);

    await archivePublicPage(d1, 'campaign-a', 'admin-editor', 'req_public_page_archive_a_0004');
    expect(await listPublishedCompetitionArticles(d1, pageA.slug)).toEqual([]);
    expect(await getPublishedCompetitionArticle(d1, pageA.slug, visibleUntilParentArchive.slug)).toBeNull();
  });

  it('omits SQL-valid published rows that fail the full public article DTO schema', async () => {
    await previewPublicPage(d1, 'campaign-a', 'admin-editor', 'req_public_page_preview_invalid_dto_0004');
    await publishPublicPage(d1, 'campaign-a', 'admin-editor', 'req_public_page_publish_invalid_dto_0004');
    const page = sqlite.prepare(`
      SELECT slug FROM competition_public_pages WHERE campaign_id = 'campaign-a'
    `).get() as { slug: string };

    sqlite.prepare(`
      INSERT INTO competition_articles (
        id, campaign_id, title, slug, summary, cover_image_url, content, type, status,
        published_at, created_by, created_at, updated_by, updated_at
      ) VALUES (
        'article-invalid-public-dto', 'campaign-a', 'Malformed legacy article',
        'malformed-legacy-article', 'A non-empty summary', 'not-a-valid-url',
        'A non-empty body', 'ANNOUNCEMENT', 'PUBLISHED',
        '2026-08-25T01:00:00.000Z', 'legacy-sql', '2026-08-25T01:00:00.000Z',
        NULL, '2026-08-25T01:00:00.000Z'
      )
    `).run();

    expect(await listPublishedCompetitionArticles(d1, page.slug)).toEqual([]);
    expect(await getPublishedCompetitionArticle(d1, page.slug, 'malformed-legacy-article')).toBeNull();
  });

  it('refuses to publish a preexisting draft that fails the full public article DTO schema', async () => {
    const draft = await createDraft(
      'campaign-a', 'malformed-draft', 'req_article_invalid_draft_create_0004',
    );
    sqlite.prepare(`
      UPDATE competition_articles SET cover_image_url = 'not-a-valid-url' WHERE id = ?
    `).run(draft.id);
    const beforeAuditCount = auditRows().length;

    await expect(publishCompetitionArticle(
      d1, 'campaign-a', draft.id, 'admin-editor', 'req_article_invalid_draft_publish_0004',
    )).rejects.toThrow('COMPETITION_ARTICLE_NOT_READY');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', draft.id)).toMatchObject({
      status: 'DRAFT',
      coverImageUrl: 'not-a-valid-url',
      publishedAt: null,
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('audits every successful staff mutation with bounded metadata and never dumps article content', async () => {
    const secret = `TOP-SECRET-${'x'.repeat(2000)}`;
    const created = await createDraft(
      'campaign-a', 'audit-safe', 'req_article_audit_create_0005',
      { summary: 'Sensitive summary text', content: secret, type: 'INCIDENT_NOTICE' },
    );
    await updateCompetitionArticle(d1, 'campaign-a', created.id, {
      title: 'Updated audit-safe article',
      content: `${secret}-updated`,
      requestId: 'req_article_audit_update_0005',
    }, 'admin-editor');
    await publishCompetitionArticle(
      d1, 'campaign-a', created.id, 'admin-editor', 'req_article_audit_publish_0005',
    );
    await archiveCompetitionArticle(
      d1, 'campaign-a', created.id, 'admin-editor', 'req_article_audit_archive_0005',
    );

    const rows = auditRows().filter((row) => row.target_id === created.id);
    expect(rows.map((row) => row.action)).toEqual(expect.arrayContaining([
      'COMPETITION_ARTICLE_CREATED',
      'COMPETITION_ARTICLE_UPDATED',
      'COMPETITION_ARTICLE_PUBLISHED',
      'COMPETITION_ARTICLE_ARCHIVED',
    ]));
    for (const row of rows) {
      expect(row.actor_username).toBe('admin-editor');
      expect(row.request_id).toMatch(/^req_article_audit_/);
      expect(`${row.before_json ?? ''}${row.after_json ?? ''}`).not.toContain('TOP-SECRET');
      const metadata = row.after_json ? JSON.parse(row.after_json) : null;
      if (metadata) {
        expect(metadata).not.toHaveProperty('content');
        expect(metadata).not.toHaveProperty('summary');
        if (metadata.deleted !== true) expect(metadata).toHaveProperty('contentLength');
      }
    }
  });

  it('rejects a stale draft update without overwriting concurrent state or writing a false audit', async () => {
    const created = await createDraft('campaign-a', 'stale-update', 'req_article_stale_create_0006');
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_articles
        SET title = 'Concurrent title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE id = ?
      `).run(created.id);
    });

    await expect(updateCompetitionArticle(staleD1, 'campaign-a', created.id, {
      title: 'Stale title',
      requestId: 'req_article_stale_update_0006',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_ARTICLE_STALE_WRITE');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', created.id)).toMatchObject({
      title: 'Concurrent title',
      updatedBy: 'other-editor',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('rejects a stale publish while preserving the concurrent draft and writing no false audit', async () => {
    const created = await createDraft('campaign-a', 'stale-publish', 'req_article_stale_publish_create_0007');
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_articles
        SET title = 'Concurrent publish title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE id = ?
      `).run(created.id);
    });

    await expect(publishCompetitionArticle(
      staleD1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_publish_0007',
    )).rejects.toThrow('COMPETITION_ARTICLE_STALE_WRITE');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', created.id)).toMatchObject({
      title: 'Concurrent publish title',
      status: 'DRAFT',
      publishedAt: null,
      updatedBy: 'other-editor',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('rejects a stale archive while preserving the concurrent published row and writing no false audit', async () => {
    const created = await createDraft('campaign-a', 'stale-archive', 'req_article_stale_archive_create_0008');
    const published = await publishCompetitionArticle(
      d1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_archive_publish_0008',
    );
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_articles
        SET title = 'Concurrent archive title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE id = ?
      `).run(created.id);
    });

    await expect(archiveCompetitionArticle(
      staleD1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_archive_0008',
    )).rejects.toThrow('COMPETITION_ARTICLE_STALE_WRITE');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', created.id)).toMatchObject({
      title: 'Concurrent archive title',
      status: 'PUBLISHED',
      publishedAt: published.publishedAt,
      updatedBy: 'other-editor',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('rejects a stale physical draft delete while preserving the concurrent row and writing no false audit', async () => {
    const created = await createDraft('campaign-a', 'stale-delete-draft', 'req_article_stale_delete_create_0009');
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_articles
        SET title = 'Concurrent delete title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE id = ?
      `).run(created.id);
    });

    await expect(deleteCompetitionArticle(
      staleD1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_delete_0009',
    )).rejects.toThrow('COMPETITION_ARTICLE_STALE_WRITE');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', created.id)).toMatchObject({
      title: 'Concurrent delete title',
      status: 'DRAFT',
      publishedAt: null,
      updatedBy: 'other-editor',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('rejects a stale delete-as-archive while preserving concurrent published content and writing no false audit', async () => {
    const created = await createDraft(
      'campaign-a', 'stale-delete-published', 'req_article_stale_delete_published_create_0010',
    );
    const published = await publishCompetitionArticle(
      d1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_delete_published_publish_0010',
    );
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_articles
        SET title = 'Concurrent delete-as-archive title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE id = ?
      `).run(created.id);
    });

    await expect(deleteCompetitionArticle(
      staleD1, 'campaign-a', created.id, 'admin-editor', 'req_article_stale_delete_published_0010',
    )).rejects.toThrow('COMPETITION_ARTICLE_STALE_WRITE');

    expect(await getCompetitionArticleForStaff(d1, 'campaign-a', created.id)).toMatchObject({
      title: 'Concurrent delete-as-archive title',
      status: 'PUBLISHED',
      publishedAt: published.publishedAt,
      updatedBy: 'other-editor',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });
});
