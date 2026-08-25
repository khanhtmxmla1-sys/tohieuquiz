// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archivePublicPage,
  getPublicPageForStaff,
  getPublishedPublicPageBySlug,
  previewPublicPage,
  publishPublicPage,
  updatePublicPageDraft,
} from '../workers/src/competition/publicPageService';
import { createSqliteD1 } from './helpers/sqliteD1';

const portalMigration = readFileSync(
  new URL('../workers/migrations/0079_competition_public_portal.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

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

function insertCampaign(
  db: DatabaseSync,
  id = 'campaign-public-page',
  status = 'REGISTRATION',
): void {
  db.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (?, 'Sân chơi Tô Hiệu Quiz', '2026-2027', 'Asia/Ho_Chi_Minh', ?,
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
      'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run(id, status);
}

function campaignStatus(): string {
  return String((sqlite.prepare(`
    SELECT status FROM competition_campaigns WHERE id = 'campaign-public-page'
  `).get() as { status: string }).status);
}

function auditRows() {
  return sqlite.prepare(`
    SELECT actor_username, action, target_type, target_id, request_id, before_json, after_json
    FROM admin_audit_logs
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T01:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  insertCampaign(sqlite);
  sqlite.exec(portalMigration);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

describe('CompetitionPublicPage lifecycle', () => {
  it('edits only a DRAFT page and records safe before/after audit metadata', async () => {
    const before = await getPublicPageForStaff(d1, 'campaign-public-page');
    expect(before).toMatchObject({
      campaignId: 'campaign-public-page',
      status: 'DRAFT',
      heroTitle: 'Sân chơi Tô Hiệu Quiz',
      publishedAt: null,
      archivedAt: null,
    });

    const updated = await updatePublicPageDraft(d1, 'campaign-public-page', {
      slug: 'san-choi-to-hieu-quiz-2026',
      heroTitle: 'SÂN CHƠI TÔ HIỆU QUIZ 2026',
      heroSubtitle: 'Cùng học, cùng thi',
      summary: 'Trang giới thiệu cuộc thi.',
      ctaLabel: 'VÀO THI',
      requestId: 'req_public_page_update_0001',
    }, 'admin-editor');

    expect(updated).toMatchObject({
      slug: 'san-choi-to-hieu-quiz-2026',
      status: 'DRAFT',
      heroTitle: 'SÂN CHƠI TÔ HIỆU QUIZ 2026',
      heroSubtitle: 'Cùng học, cùng thi',
      summary: 'Trang giới thiệu cuộc thi.',
      updatedBy: 'admin-editor',
    });
    expect(campaignStatus()).toBe('REGISTRATION');

    const audits = auditRows();
    expect(audits).toHaveLength(1);
    const [audit] = audits;
    expect(audit).toMatchObject({
      actor_username: 'admin-editor',
      action: 'COMPETITION_PUBLIC_PAGE_UPDATED',
      target_type: 'competition_public_page',
      target_id: updated.id,
      request_id: 'req_public_page_update_0001',
    });
    const beforeMeta = JSON.parse(String(audit.before_json));
    const afterMeta = JSON.parse(String(audit.after_json));
    expect(beforeMeta).toMatchObject({ status: 'DRAFT', publishedAt: null, archivedAt: null });
    expect(afterMeta).toMatchObject({
      status: 'DRAFT',
      slug: 'san-choi-to-hieu-quiz-2026',
      publishedAt: null,
      archivedAt: null,
    });
    expect(afterMeta).not.toHaveProperty('summary');
    expect(afterMeta).not.toHaveProperty('heroSubtitle');
  });

  it('rejects a stale DRAFT edit without overwriting the concurrent row or writing audit', async () => {
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_public_pages
        SET hero_title = 'Concurrent title', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE campaign_id = 'campaign-public-page'
      `).run();
    });

    await expect(updatePublicPageDraft(staleD1, 'campaign-public-page', {
      heroTitle: 'Stale title',
      requestId: 'req_public_page_stale_update_0001',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_STALE_WRITE');

    expect(sqlite.prepare(`
      SELECT hero_title, updated_by FROM competition_public_pages
      WHERE campaign_id = 'campaign-public-page'
    `).get()).toMatchObject({
      hero_title: 'Concurrent title',
      updated_by: 'other-editor',
    });
    expect(auditRows()).toEqual([]);
  });

  it('rejects a stale lifecycle transition without reporting success or writing audit', async () => {
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_public_pages
        SET status = 'PREVIEW', updated_by = 'other-editor',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE campaign_id = 'campaign-public-page'
      `).run();
    });

    await expect(previewPublicPage(
      staleD1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_stale_preview_0001',
    )).rejects.toThrow('COMPETITION_PUBLIC_PAGE_STALE_WRITE');

    expect(auditRows()).toEqual([]);
    expect((await getPublicPageForStaff(d1, 'campaign-public-page'))?.updatedBy).toBe('other-editor');
  });

  it('rejects arbitrary status edits and enforces DRAFT -> PREVIEW -> PUBLISHED -> ARCHIVED', async () => {
    await expect(updatePublicPageDraft(d1, 'campaign-public-page', {
      status: 'PUBLISHED',
      requestId: 'req_public_page_bad_status_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_STATUS_MANAGED');

    await expect(publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_skip_publish_0002',
    )).rejects.toThrow('COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION');

    const preview = await previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_preview_0002',
    );
    expect(preview.status).toBe('PREVIEW');
    expect(campaignStatus()).toBe('REGISTRATION');

    await expect(updatePublicPageDraft(d1, 'campaign-public-page', {
      heroTitle: 'Cannot edit in preview',
      requestId: 'req_public_page_edit_preview_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_NOT_DRAFT');

    await expect(previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_preview_again_0002',
    )).rejects.toThrow('COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION');

    vi.setSystemTime(new Date('2026-09-01T02:03:04.000Z'));
    const published = await publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_publish_0002',
    );
    expect(published).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: '2026-09-01T02:03:04.000Z',
      archivedAt: null,
    });
    expect(campaignStatus()).toBe('REGISTRATION');

    await expect(updatePublicPageDraft(d1, 'campaign-public-page', {
      heroTitle: 'Cannot edit when published',
      requestId: 'req_public_page_edit_published_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_NOT_DRAFT');

    await expect(publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_publish_again_0002',
    )).rejects.toThrow('COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION');

    vi.setSystemTime(new Date('2026-10-01T03:04:05.000Z'));
    const archived = await archivePublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_archive_0002',
    );
    expect(archived).toMatchObject({
      status: 'ARCHIVED',
      publishedAt: '2026-09-01T02:03:04.000Z',
      archivedAt: '2026-10-01T03:04:05.000Z',
    });
    expect(campaignStatus()).toBe('REGISTRATION');

    await expect(updatePublicPageDraft(d1, 'campaign-public-page', {
      heroTitle: 'Cannot edit when archived',
      requestId: 'req_public_page_edit_archived_0002',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_NOT_DRAFT');

    await expect(previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_backward_0002',
    )).rejects.toThrow('COMPETITION_PUBLIC_PAGE_INVALID_TRANSITION');
  });

  it('never resolves non-PUBLISHED pages anonymously', async () => {
    const draft = await getPublicPageForStaff(d1, 'campaign-public-page');
    expect(await getPublishedPublicPageBySlug(d1, draft!.slug)).toBeNull();

    const preview = await previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_preview_0003',
    );
    expect(await getPublishedPublicPageBySlug(d1, preview.slug)).toBeNull();

    const published = await publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_publish_0003',
    );
    const anonymousPage = await getPublishedPublicPageBySlug(d1, published.slug);
    expect(anonymousPage).toMatchObject({
      slug: published.slug,
      heroTitle: published.heroTitle,
      publishedAt: published.publishedAt,
    });
    expect(Object.keys(anonymousPage!).sort()).toEqual([
      'ctaLabel',
      'heroImageUrl',
      'heroSubtitle',
      'heroTitle',
      'ogImageUrl',
      'publishedAt',
      'seoDescription',
      'seoTitle',
      'slug',
      'summary',
    ].sort());
    for (const forbidden of [
      'id', 'campaignId', 'status', 'archivedAt',
      'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
    ]) {
      expect(anonymousPage).not.toHaveProperty(forbidden);
    }

    await archivePublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_archive_0003',
    );
    expect(await getPublishedPublicPageBySlug(d1, published.slug)).toBeNull();
  });

  it('locks the slug after first publish and preserves the first published timestamp', async () => {
    await previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_preview_0004',
    );
    vi.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
    const published = await publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_publish_0004',
    );

    await expect(updatePublicPageDraft(d1, 'campaign-public-page', {
      slug: 'changed-after-publish',
      requestId: 'req_public_page_slug_locked_0004',
    }, 'admin-editor')).rejects.toThrow('COMPETITION_PUBLIC_PAGE_SLUG_LOCKED');

    vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
    const archived = await archivePublicPage(
      d1,
      'campaign-public-page',
      'admin-editor',
      'req_public_page_archive_0004',
    );
    expect(archived.publishedAt).toBe(published.publishedAt);

    const persisted = sqlite.prepare(`
      SELECT slug, published_at FROM competition_public_pages WHERE campaign_id = ?
    `).get('campaign-public-page') as { slug: string; published_at: string };
    expect(persisted.slug).toBe(published.slug);
    expect(persisted.published_at).toBe('2026-09-05T10:00:00.000Z');
  });

  it('audits each lifecycle mutation with actor/request IDs and before/after state metadata', async () => {
    await previewPublicPage(
      d1,
      'campaign-public-page',
      'admin-preview',
      'req_public_page_preview_0005',
    );
    await publishPublicPage(
      d1,
      'campaign-public-page',
      'admin-publish',
      'req_public_page_publish_0005',
    );
    await archivePublicPage(
      d1,
      'campaign-public-page',
      'admin-archive',
      'req_public_page_archive_0005',
    );

    const rows = auditRows();
    expect(rows.map((row) => row.action)).toEqual([
      'COMPETITION_PUBLIC_PAGE_ARCHIVED',
      'COMPETITION_PUBLIC_PAGE_PREVIEWED',
      'COMPETITION_PUBLIC_PAGE_PUBLISHED',
    ]);

    const byAction = Object.fromEntries(rows.map((row) => [row.action, row]));
    expect(byAction.COMPETITION_PUBLIC_PAGE_PREVIEWED).toMatchObject({
      actor_username: 'admin-preview',
      request_id: 'req_public_page_preview_0005',
      target_type: 'competition_public_page',
    });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_PREVIEWED.before_json))).toMatchObject({ status: 'DRAFT' });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_PREVIEWED.after_json))).toMatchObject({ status: 'PREVIEW' });

    expect(byAction.COMPETITION_PUBLIC_PAGE_PUBLISHED).toMatchObject({
      actor_username: 'admin-publish',
      request_id: 'req_public_page_publish_0005',
    });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_PUBLISHED.before_json))).toMatchObject({ status: 'PREVIEW' });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_PUBLISHED.after_json))).toMatchObject({ status: 'PUBLISHED' });

    expect(byAction.COMPETITION_PUBLIC_PAGE_ARCHIVED).toMatchObject({
      actor_username: 'admin-archive',
      request_id: 'req_public_page_archive_0005',
    });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_ARCHIVED.before_json))).toMatchObject({ status: 'PUBLISHED' });
    expect(JSON.parse(String(byAction.COMPETITION_PUBLIC_PAGE_ARCHIVED.after_json))).toMatchObject({ status: 'ARCHIVED' });
  });
});
