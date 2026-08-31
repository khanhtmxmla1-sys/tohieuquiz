// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { signJWT } from '../workers/src/utils/jwt';
import { createSqliteD1 } from './helpers/sqliteD1';

const portalMigration = readFileSync(
  new URL('../workers/migrations/0080_competition_public_portal.sql', import.meta.url),
  'utf8',
);
const secret = 'competition-public-content-routes-secret';

let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

function createSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, class_id TEXT NOT NULL, created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE competition_campaigns (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, school_year TEXT NOT NULL,
      timezone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
      audience_rule_json TEXT NOT NULL DEFAULT '{}', audience_snapshot_id TEXT,
      eligibility_policy_json TEXT NOT NULL DEFAULT '{}', starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_school_exam_events (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, eligibility_snapshot_version INTEGER NOT NULL,
      title TEXT NOT NULL, exam_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
      ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME', exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM',
      capacity_profile_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, published_at TEXT, UNIQUE (campaign_id, id),
      FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id)
    );
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY, audience TEXT NOT NULL, percentage INTEGER NOT NULL,
      allow_users_json TEXT NOT NULL, allow_classes_json TEXT NOT NULL,
      starts_at TEXT, ends_at TEXT, stop_conditions_json TEXT NOT NULL,
      reason TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
    );
    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY, actor_username TEXT NOT NULL, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, request_id TEXT NOT NULL,
      before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
    );
    INSERT INTO teachers (username) VALUES ('admin'), ('teacher-4');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-5a', '5A', 'other-teacher', '2026-08-01T00:00:00.000Z');
    INSERT INTO students (id, username, full_name, password_hash, class_id, created_at)
      VALUES ('student-1', 'student1', 'Student One', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z');
  `);
}

function insertCampaign(
  id: string,
  audienceRule: { gradeLevels: number[]; classIds?: string[] },
): void {
  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (?, ?, '2026-2027', 'Asia/Ho_Chi_Minh', 'DRAFT', ?,
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
      'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run(id, `Campaign ${id}`, JSON.stringify(audienceRule));
}

async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
  requestId?: string,
): Promise<Response> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (requestId) headers.set('x-request-id', requestId);
  const request = new Request(`https://api.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return await handleCompetitionRoutes(request, env as any, path, method)
    ?? new Response(JSON.stringify({ status: 'error', message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  createSchema(sqlite);
  insertCampaign('campaign-scoped', { gradeLevels: [4], classIds: ['class-4a'] });
  insertCampaign('campaign-private', { gradeLevels: [5], classIds: ['class-5a'] });
  insertCampaign('campaign-grade-only', { gradeLevels: [4] });
  insertCampaign('campaign-inconsistent', { gradeLevels: [5], classIds: ['class-4a'] });
  sqlite.exec(portalMigration);
  sqlite.exec(`
    INSERT INTO feature_flags VALUES ('competition_v1', 'competition runtime', 1, 'competition-platform', 1, datetime('now'), datetime('now'));
    INSERT INTO feature_flag_rules VALUES ('competition_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'test fixture', 'test', datetime('now'));
  `);
  sqlite.prepare(`UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'competition_public_content_admin_v1'`).run();
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };
  adminCookie = `auth_token=${await signJWT({ username: 'admin', role: 'admin', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
  teacherCookie = `auth_token=${await signJWT({ username: 'teacher-4', role: 'teacher', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
  studentCookie = `auth_token=${await signJWT({ id: 'student-1', username: 'student1', role: 'student', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
});

afterEach(() => sqlite.close());

describe('Competition staff public-content routes', () => {
  it('allows scoped Teacher GET reads only and does not disclose out-of-scope campaigns', async () => {
    for (const suffix of ['public-page', 'articles', 'golden-board-config', 'award-rules']) {
      expect((await api(`/api/competitions/campaign-scoped/${suffix}`, 'GET', undefined, teacherCookie)).status)
        .toBe(200);
    }

    const teacherMutation = await api('/api/competitions/campaign-scoped/public-page', 'PUT', {
      heroTitle: 'Forbidden edit', requestId: 'req_teacher_forbidden_0001',
    }, teacherCookie);
    expect(teacherMutation.status).toBe(403);

    const outOfScope = await api('/api/competitions/campaign-private/public-page', 'GET', undefined, teacherCookie);
    const unknown = await api('/api/competitions/campaign-missing/public-page', 'GET', undefined, teacherCookie);
    expect(outOfScope.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await outOfScope.json()).toEqual(await unknown.json());
  });

  it('uses canonical grade and optional class restrictions for Teacher campaign access', async () => {
    const gradeOnly = await api(
      '/api/competitions/campaign-grade-only/public-page', 'GET', undefined, teacherCookie,
    );
    const inconsistent = await api(
      '/api/competitions/campaign-inconsistent/public-page', 'GET', undefined, teacherCookie,
    );

    expect(gradeOnly.status).toBe(200);
    expect(inconsistent.status).toBe(404);
  });

  it('allows validated Admin mutations across portal content resources', async () => {
    const page = await api('/api/competitions/campaign-scoped/public-page', 'PUT', {
      heroTitle: 'Competition portal', requestId: 'req_page_update_0001',
    }, adminCookie);
    expect(page.status).toBe(200);
    expect(await page.json()).toMatchObject({ publicPage: { heroTitle: 'Competition portal' } });

    const article = await api('/api/competitions/campaign-scoped/articles', 'POST', {
      campaignId: 'campaign-scoped', title: 'Rules', slug: 'rules', content: 'Rules content',
      type: 'RULES', requestId: 'req_article_create_0001',
    }, adminCookie);
    expect(article.status).toBe(201);
    const articleId = String((await article.json() as any).article.id);
    expect((await api(`/api/competitions/campaign-scoped/articles/${articleId}`, 'PATCH', {
      title: 'Updated rules', requestId: 'req_article_update_0001',
    }, adminCookie)).status).toBe(200);
    expect((await api(`/api/competitions/campaign-scoped/articles/${articleId}`, 'DELETE', undefined,
      adminCookie, 'req_article_delete_0001')).status).toBe(200);

    expect((await api('/api/competitions/campaign-scoped/golden-board-config', 'PUT', {
      enabled: false, title: 'Golden Board', requestId: 'req_board_update_0001',
    }, adminCookie)).status).toBe(200);

    const award = await api('/api/competitions/campaign-scoped/award-rules', 'POST', {
      campaignId: 'campaign-scoped', requestId: 'req_award_create_0001',
      rules: [{ scope: 'EVENT', rankFrom: 1, rankTo: 1, awardCode: 'GOLD', awardLabel: 'Gold', sortOrder: 0 }],
    }, adminCookie);
    expect(award.status).toBe(201);
    expect((await api('/api/competitions/campaign-scoped/award-rules/1/activate', 'POST', {
      requestId: 'req_award_activate_0001',
    }, adminCookie)).status).toBe(200);
  });

  it('creates a missing page and exposes canonical article publish/archive transitions', async () => {
    insertCampaign('campaign-created-after-portal-migration', { gradeLevels: [4], classIds: ['class-4a'] });

    const page = await api('/api/competitions/campaign-created-after-portal-migration/public-page', 'POST', {
      slug: 'campaign-created-after-portal-migration',
      heroTitle: 'Campaign created after migration',
      summary: 'Staging campaign content',
      requestId: 'req_page_create_route_0001',
    }, adminCookie);
    expect(page.status).toBe(201);
    expect(await page.json()).toMatchObject({
      publicPage: {
        campaignId: 'campaign-created-after-portal-migration',
        status: 'DRAFT',
      },
    });
    expect((await api('/api/competitions/campaign-created-after-portal-migration/public-page', 'POST', {
      slug: 'campaign-created-after-portal-migration',
      heroTitle: 'Duplicate page',
      requestId: 'req_page_create_route_0002',
    }, adminCookie)).status).toBe(409);

    const created = await api('/api/competitions/campaign-created-after-portal-migration/articles', 'POST', {
      campaignId: 'campaign-created-after-portal-migration',
      title: 'Published rules',
      slug: 'published-rules',
      summary: 'Published rules summary',
      content: 'Published rules content',
      type: 'RULES',
      requestId: 'req_article_create_route_0001',
    }, adminCookie);
    expect(created.status).toBe(201);
    const articleId = String((await created.json() as any).article.id);

    const published = await api(
      `/api/competitions/campaign-created-after-portal-migration/articles/${articleId}/publish`,
      'POST',
      { requestId: 'req_article_publish_route_0001' },
      adminCookie,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ article: { id: articleId, status: 'PUBLISHED' } });

    const archived = await api(
      `/api/competitions/campaign-created-after-portal-migration/articles/${articleId}/archive`,
      'POST',
      { requestId: 'req_article_archive_route_0001' },
      adminCookie,
    );
    expect(archived.status).toBe(200);
    expect(await archived.json()).toMatchObject({ article: { id: articleId, status: 'ARCHIVED' } });
  });

  it('keeps article detail scoped to the route campaign for Admin reads', async () => {
    const created = await api('/api/competitions/campaign-scoped/articles', 'POST', {
      campaignId: 'campaign-scoped', title: 'Scoped article title', slug: 'scoped-article',
      content: 'Scoped article content', type: 'RULES', requestId: 'req_article_privacy_0001',
    }, adminCookie);
    expect(created.status).toBe(201);
    const expectedArticle = (await created.json() as any).article;
    const articleId = String(expectedArticle.id);

    const sameCampaign = await api(
      `/api/competitions/campaign-scoped/articles/${articleId}`, 'GET', undefined, adminCookie,
    );
    expect(sameCampaign.status).toBe(200);
    expect(await sameCampaign.json()).toMatchObject({ article: expectedArticle });

    const otherCampaign = await api(
      `/api/competitions/campaign-private/articles/${articleId}`, 'GET', undefined, adminCookie,
    );
    expect(otherCampaign.status).toBe(404);
    const privateBody = await otherCampaign.text();
    expect(privateBody).not.toContain(articleId);
    expect(privateBody).not.toContain('Scoped article title');
    expect(privateBody).not.toContain('Scoped article content');
  });

  it('enforces strict mutation schemas, request IDs, and route campaign authority', async () => {
    expect((await api('/api/competitions/campaign-scoped/public-page', 'PUT', {
      heroTitle: 'Valid title', requestId: 'req_page_strict_0001', unknownField: true,
    }, adminCookie)).status).toBe(400);

    expect((await api('/api/competitions/campaign-scoped/public-page/publish', 'POST', {},
      adminCookie)).status).toBe(400);

    const draft = await api('/api/competitions/campaign-scoped/articles', 'POST', {
      campaignId: 'campaign-scoped', title: 'Draft', slug: 'draft-for-delete', content: 'Draft content',
      type: 'RULES', requestId: 'req_article_strict_create_0001',
    }, adminCookie);
    expect(draft.status).toBe(201);
    const draftId = String((await draft.json() as any).article.id);
    expect((await api(`/api/competitions/campaign-scoped/articles/${draftId}`, 'DELETE', undefined,
      adminCookie)).status).toBe(400);

    expect((await api('/api/competitions/campaign-scoped/articles', 'POST', {
      campaignId: 'campaign-private', title: 'Wrong campaign', slug: 'wrong-campaign',
      content: 'Wrong campaign content', type: 'RULES', requestId: 'req_article_strict_0002',
    }, adminCookie)).status).toBe(400);

    expect((await api('/api/competitions/campaign-scoped/award-rules', 'POST', {
      campaignId: 'campaign-private', requestId: 'req_award_strict_0001',
      rules: [{ scope: 'EVENT', rankFrom: 1, rankTo: 1, awardCode: 'GOLD', awardLabel: 'Gold', sortOrder: 0 }],
    }, adminCookie)).status).toBe(400);
  });

  it('supports page preview/publish/archive and rejects Student or anonymous access', async () => {
    for (const action of ['preview', 'publish', 'archive']) {
      const response = await api(`/api/competitions/campaign-scoped/public-page/${action}`, 'POST', {
        requestId: `req_page_${action}_0001`,
      }, adminCookie);
      expect(response.status).toBe(200);
    }

    expect((await api('/api/competitions/campaign-scoped/public-page', 'GET', undefined, studentCookie)).status)
      .toBe(403);
    expect((await api('/api/competitions/campaign-scoped/public-page')).status).toBe(401);
  });
});
