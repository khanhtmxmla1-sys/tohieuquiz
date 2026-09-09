// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from './helpers/sqliteD1';
import { handlePublicCompetitionRoutes } from '../workers/src/routes/publicCompetitions';
import { createWorkerFetch } from '../workers/src/router/createWorkerFetch';
import {
  getPublishedPublicPageProjectionBySlug,
  listPublishedPublicPageProjections,
} from '../workers/src/competition/publicPageService';
import { resolveApiRoute } from '../src/services/api/routeResolver';

const NOW = '2026-08-25T06:00:00.000Z';

let sqlite: DatabaseSync;
let env: { DB: D1Database };

function seedSchema() {
  sqlite.exec(`
    CREATE TABLE competition_campaigns (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, school_year TEXT NOT NULL,
      timezone TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT'
    );
    CREATE TABLE competition_public_pages (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL, hero_title TEXT NOT NULL, hero_subtitle TEXT,
      hero_image_url TEXT, summary TEXT, cta_label TEXT NOT NULL,
      seo_title TEXT, seo_description TEXT, og_image_url TEXT,
      published_at TEXT, archived_at TEXT, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_rounds (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, round_number INTEGER NOT NULL,
      opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, status TEXT NOT NULL
    );
    CREATE INDEX idx_competition_rounds_campaign_window
      ON competition_rounds(campaign_id, status, opens_at, closes_at, round_number);
    CREATE TABLE competition_articles (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL,
      summary TEXT, cover_image_url TEXT, content TEXT NOT NULL, type TEXT NOT NULL,
      status TEXT NOT NULL, published_at TEXT, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_golden_board_configs (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, source_event_id TEXT,
      enabled INTEGER NOT NULL, display_mode TEXT NOT NULL, title TEXT NOT NULL,
      award_rule_version INTEGER, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_school_exam_events (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL);
    CREATE TABLE competition_award_rule_versions (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE competition_award_rules (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, version INTEGER NOT NULL,
      scope TEXT NOT NULL, grade_level INTEGER, rank_from INTEGER NOT NULL,
      rank_to INTEGER NOT NULL, award_code TEXT NOT NULL, award_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE competition_school_exam_publications (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, version INTEGER NOT NULL,
      ranking_version INTEGER, status TEXT NOT NULL, published_at TEXT
    );
    CREATE TABLE competition_school_exam_publication_results (
      id TEXT PRIMARY KEY, publication_id TEXT NOT NULL, event_id TEXT NOT NULL,
      publication_version INTEGER NOT NULL, ranking_version INTEGER NOT NULL,
      student_id TEXT NOT NULL, original_class_id TEXT NOT NULL, grade_level INTEGER NOT NULL,
      rank_event INTEGER NOT NULL, rank_grade INTEGER NOT NULL
    );
    CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL);
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE system_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL);
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY, description TEXT NOT NULL, enabled INTEGER NOT NULL,
      owner TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY, audience TEXT NOT NULL, percentage INTEGER NOT NULL,
      allow_users_json TEXT NOT NULL, allow_classes_json TEXT NOT NULL,
      starts_at TEXT, ends_at TEXT, stop_conditions_json TEXT NOT NULL,
      reason TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO feature_flags VALUES
      ('competition_public_portal_read_v1', 'public', 1, 'competition', 1, '${NOW}', '${NOW}'),
      ('competition_golden_board_v1', 'board', 1, 'competition', 1, '${NOW}', '${NOW}');
    INSERT INTO feature_flag_rules VALUES
      ('competition_public_portal_read_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'test', 'test', '${NOW}'),
      ('competition_golden_board_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'test', 'test', '${NOW}');
  `);
}

function seedCampaign(
  id: string,
  slug: string,
  status: 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED' = 'PUBLISHED',
  campaignStatus: 'DRAFT' | 'PUBLISHED' = 'DRAFT',
) {
  const publishedAt = status === 'PUBLISHED' || status === 'ARCHIVED' ? '2026-08-20T00:00:00.000Z' : null;
  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, starts_at, ends_at, status
    ) VALUES (?, ?, '2026-2027', 'Asia/Ho_Chi_Minh',
      '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', ?)
  `).run(id, `Competition ${id}`, campaignStatus);
  sqlite.prepare(`
    INSERT INTO competition_public_pages VALUES (
      ?, ?, ?, ?, ?, 'Cùng học, cùng vui', 'https://example.edu/hero.jpg',
      'Sáu vòng thi dành cho học sinh.', 'VÀO THI', NULL, NULL, NULL,
      ?, ?, 'admin', '2026-08-01T00:00:00.000Z', NULL, '2026-08-20T00:00:00.000Z')
  `).run(`page-${id}`, id, slug, status, `Hero ${id}`, publishedAt, status === 'ARCHIVED' ? NOW : null);
  const insertRound = sqlite.prepare(`
    INSERT INTO competition_rounds VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (let round = 1; round <= 6; round += 1) {
    insertRound.run(
      `${id}-round-${round}`,
      id,
      round,
      `2026-08-${String(round).padStart(2, '0')}T00:00:00.000Z`,
      `2026-08-${String(round + 1).padStart(2, '0')}T00:00:00.000Z`,
      'OPEN',
    );
  }
}

function seedArticle(campaignId: string, id: string, slug: string, status = 'PUBLISHED') {
  sqlite.prepare(`
    INSERT INTO competition_articles VALUES (
      ?, ?, ?, ?, 'Tóm tắt bài viết.', NULL, 'Nội dung công khai.', 'RULES', ?,
      ?, 'admin', '2026-08-01T00:00:00.000Z', NULL, '2026-08-21T00:00:00.000Z')
  `).run(id, campaignId, `Article ${id}`, slug, status, status === 'PUBLISHED' ? '2026-08-21T00:00:00.000Z' : null);
}

function seedIncompletePublishedCampaign() {
  seedCampaign('campaign-incomplete', 'incomplete-competition', 'PUBLISHED', 'DRAFT');
  sqlite.prepare(`
    UPDATE competition_rounds
    SET status = 'SCHEDULED'
    WHERE campaign_id = ? AND round_number = 1
  `).run('campaign-incomplete');
  sqlite.prepare(`
    DELETE FROM competition_rounds
    WHERE campaign_id = ? AND round_number > 1
  `).run('campaign-incomplete');
  seedArticle('campaign-incomplete', 'article-incomplete', 'incomplete-article');
}

function seedGoldenBoard() {
  sqlite.exec(`
    INSERT INTO competition_school_exam_events VALUES ('event-1', 'campaign-published');
    INSERT INTO competition_award_rule_versions VALUES ('rules-v3', 'campaign-published', 3, 'ACTIVE');
    INSERT INTO competition_award_rules VALUES (
      'rule-1', 'campaign-published', 3, 'EVENT', NULL, 1, 1, 'GOLD', 'Giải Nhất', 1
    );
    INSERT INTO competition_golden_board_configs VALUES (
      'board-1', 'campaign-published', 'event-1', 1, 'AWARD_WINNERS', 'Bảng vàng', 3,
      'admin', '2026-08-22T00:00:00.000Z'
    );
    INSERT INTO competition_school_exam_publications VALUES (
      'publication-2', 'event-1', 2, 4, 'PUBLISHED', '2026-08-23T00:00:00.000Z'
    );
    INSERT INTO students VALUES ('student-secret-id', 'Nguyễn Văn An');
    INSERT INTO classes VALUES ('class-secret-id', '5A');
    INSERT INTO system_settings VALUES ('school_name', 'Tiểu học Tô Hiệu');
    INSERT INTO competition_school_exam_publication_results VALUES (
      'result-secret-id', 'publication-2', 'event-1', 2, 4,
      'student-secret-id', 'class-secret-id', 5, 1, 1
    );
  `);
}

function request(path: string, init?: RequestInit) {
  return new Request(`https://api.thtohieu.com${path}`, init);
}

async function route(path: string, init?: RequestInit) {
  const req = request(path, init);
  return handlePublicCompetitionRoutes(req, env as any, new URL(req.url).pathname, req.method, {
    now: () => new Date(NOW),
  });
}

async function routeAt(path: string, now: string, init?: RequestInit) {
  const req = request(path, init);
  return handlePublicCompetitionRoutes(req, env as any, new URL(req.url).pathname, req.method, {
    now: () => new Date(now),
  });
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  seedSchema();
  seedCampaign('campaign-published', 'published-competition');
  seedCampaign('campaign-draft', 'draft-competition', 'DRAFT');
  seedCampaign('campaign-preview', 'preview-competition', 'PREVIEW');
  seedCampaign('campaign-archived', 'archived-competition', 'ARCHIVED');
  seedArticle('campaign-published', 'article-public', 'the-le');
  seedArticle('campaign-published', 'article-draft', 'draft-only', 'DRAFT');
  seedGoldenBoard();
  env = { DB: createSqliteD1(sqlite) };
});

afterEach(() => sqlite.close());

describe('anonymous Competition public routes', () => {
  it('returns bounded explicit PUBLISHED list/detail DTOs with validators', async () => {
    for (let index = 0; index < 105; index += 1) {
      seedCampaign(`extra-${index}`, `extra-${index}`);
    }

    const listResponse = await route('/api/public/competitions');
    const listBody = await listResponse!.json() as any;
    expect(listResponse!.status).toBe(200);
    expect(listBody.status).toBe('success');
    expect(listBody.data).toHaveLength(100);
    expect(listBody.data.some((item: any) => item.slug === 'draft-competition')).toBe(false);
    expect(listBody.data[0]).not.toHaveProperty('campaignId');
    expect(listResponse!.headers.get('etag')).toMatch(/^"/);
    expect(listResponse!.headers.get('last-modified')).toBeTruthy();

    const detailResponse = await route('/api/public/competitions/published-competition');
    const detailBody = await detailResponse!.json() as any;
    expect(detailResponse!.status).toBe(200);
    expect(detailBody.data).toMatchObject({
      slug: 'published-competition',
      publicState: 'ONGOING',
      hero: { title: 'Hero campaign-published' },
      cta: { label: 'VÀO THI' },
      articleSummaryAvailable: true,
    });
    expect(detailBody.data.rounds).toHaveLength(6);
    expect(detailBody.data.articles).toHaveLength(1);
    expect(detailBody.data).not.toHaveProperty('id');
    expect(detailResponse!.headers.get('cache-control')).toContain('max-age=60');

    const notModified = await route('/api/public/competitions/published-competition', {
      headers: { 'If-None-Match': detailResponse!.headers.get('etag')! },
    });
    expect(notModified!.status).toBe(304);
  });

  it('returns bounded PUBLISHED articles and hides draft/unknown resources behind one 404 shape', async () => {
    for (let index = 0; index < 105; index += 1) {
      seedArticle('campaign-published', `bulk-${index}`, `bulk-${index}`);
    }

    const articlesResponse = await route('/api/public/competitions/published-competition/articles');
    const articlesBody = await articlesResponse!.json() as any;
    expect(articlesResponse!.status).toBe(200);
    expect(articlesBody.data).toHaveLength(100);
    expect(articlesBody.data.some((item: any) => item.slug === 'draft-only')).toBe(false);
    expect(articlesResponse!.headers.get('etag')).toBeTruthy();
    expect(articlesResponse!.headers.get('last-modified')).toBeTruthy();

    const articleResponse = await route('/api/public/competitions/published-competition/articles/the-le');
    const articleBody = await articleResponse!.json() as any;
    expect(articleResponse!.status).toBe(200);
    expect(articleBody.data).toEqual(expect.objectContaining({ slug: 'the-le', type: 'RULES' }));
    expect(articleBody.data).not.toHaveProperty('campaignId');

    const missingBodies = [];
    for (const path of [
      '/api/public/competitions/draft-competition',
      '/api/public/competitions/preview-competition',
      '/api/public/competitions/archived-competition',
      '/api/public/competitions/unknown',
      '/api/public/competitions/published-competition/articles/draft-only',
      '/api/public/competitions/published-competition/articles/unknown',
    ]) {
      const response = await route(path);
      expect(response!.status).toBe(404);
      missingBodies.push(await response!.json());
    }
    expect(new Set(missingBodies.map(JSON.stringify)).size).toBe(1);
    expect(missingBodies[0]).toEqual({ status: 'error', message: 'Not found' });
  });

  it('returns only allowlisted Golden Board data and versions its validator', async () => {
    const response = await route('/api/public/competitions/published-competition/golden-board');
    const body = await response!.json() as any;

    expect(response!.status).toBe(200);
    expect(body.data).toEqual({
      winners: [{
        fullName: 'Nguyễn Văn An', className: '5A', schoolName: 'Tiểu học Tô Hiệu',
        gradeLevel: 5, awardCode: 'GOLD', awardLabel: 'Giải Nhất',
      }],
      publicationVersion: 2,
      rankingVersion: 4,
      awardRuleVersion: 3,
      publishedAt: '2026-08-23T00:00:00.000Z',
    });
    expect(JSON.stringify(body)).not.toMatch(/student-secret-id|result-secret-id|class-secret-id/);
    expect(response!.headers.get('etag')).toContain('2-4-3');
  });

  it('returns a generic 404 when a configured Golden Board has no published source', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    sqlite.prepare(`
      UPDATE competition_school_exam_publications
      SET status = 'PREPARED', published_at = NULL
      WHERE id = 'publication-2'
    `).run();

    const req = request('/api/public/competitions/published-competition/golden-board');
    const response = await handlePublicCompetitionRoutes(
      req,
      env as any,
      new URL(req.url).pathname,
      req.method,
      { now: () => new Date(NOW), logger },
    );

    expect(response!.status).toBe(404);
    expect(await response!.json()).toEqual({ status: 'error', message: 'Not found' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns logged safe 5xx for infrastructure failures while genuine absence stays generic 404', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    const failingRequest = request('/api/public/competitions');
    const failingDb = {
      prepare(sql: string) {
        if (sql.includes('FROM feature_flags f')) {
          return {
            bind() { return this; },
            async first() {
              return {
                flag_key: 'competition_public_portal_read_v1', description: 'public', enabled: 1,
                owner: 'competition', version: 1, audience: 'all', percentage: 100,
                allow_users_json: '[]', allow_classes_json: '[]', starts_at: null, ends_at: null,
                stop_conditions_json: '{}', reason: 'test', updated_by: 'test', updated_at: NOW,
              };
            },
          };
        }
        throw new Error('D1 transient outage');
      },
    };
    const response = await handlePublicCompetitionRoutes(
      failingRequest,
      { DB: failingDb } as any,
      '/api/public/competitions',
      'GET',
      { now: () => new Date(NOW), logger },
    );

    expect(response!.status).toBe(500);
    expect(await response!.json()).toMatchObject({
      status: 'error',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(logger.error).toHaveBeenCalled();

    const missing = await route('/api/public/competitions/not-published');
    expect(missing!.status).toBe(404);
    expect(await missing!.json()).toEqual({ status: 'error', message: 'Not found' });
  });

  it('hides a malformed PUBLISHED competition projection without turning validation data into a 5xx', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    sqlite.prepare(`
      UPDATE competition_public_pages
      SET hero_image_url = 'staff-only malformed image value'
      WHERE campaign_id = 'campaign-published'
    `).run();

    const listRequest = request('/api/public/competitions');
    const listResponse = await handlePublicCompetitionRoutes(
      listRequest,
      env as any,
      new URL(listRequest.url).pathname,
      listRequest.method,
      { now: () => new Date(NOW), logger },
    );
    expect(listResponse!.status).toBe(200);
    expect(await listResponse!.json()).toEqual({ status: 'success', data: [] });

    const detailRequest = request('/api/public/competitions/published-competition');
    const detailResponse = await handlePublicCompetitionRoutes(
      detailRequest,
      env as any,
      new URL(detailRequest.url).pathname,
      detailRequest.method,
      { now: () => new Date(NOW), logger },
    );
    expect(detailResponse!.status).toBe(404);
    expect(await detailResponse!.json()).toEqual({ status: 'error', message: 'Not found' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns logged sanitized 5xx when PUBLISHED article list/detail data is malformed', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    sqlite.prepare(`
      UPDATE competition_articles
      SET cover_image_url = 'staff-only malformed article image',
          content = 'staff-only internal article content'
      WHERE id = 'article-public'
    `).run();

    for (const path of [
      '/api/public/competitions/published-competition/articles',
      '/api/public/competitions/published-competition/articles/the-le',
    ]) {
      const req = request(path);
      const response = await handlePublicCompetitionRoutes(
        req,
        env as any,
        new URL(req.url).pathname,
        req.method,
        { now: () => new Date(NOW), logger },
      );
      const body = await response!.json() as any;
      expect(response!.status).toBe(500);
      expect(body).toMatchObject({
        status: 'error',
        message: 'Internal server error',
        requestId: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toMatch(/staff-only|article-public|cover_image_url/i);
    }
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('skips incomplete published projections while keeping valid detail and published articles available', async () => {
    seedIncompletePublishedCampaign();
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    const listRequest = request('/api/public/competitions');
    const listResponse = await handlePublicCompetitionRoutes(
      listRequest,
      env as any,
      new URL(listRequest.url).pathname,
      listRequest.method,
      { now: () => new Date(NOW), logger },
    );
    const listBody = await listResponse!.json() as any;

    expect(listResponse!.status).toBe(200);
    expect(listBody.data.map((item: any) => item.slug)).toEqual(['published-competition']);
    expect(logger.warn).toHaveBeenCalledTimes(0);
    expect(logger.error).not.toHaveBeenCalled();

    const invalidDetail = await route('/api/public/competitions/incomplete-competition');
    expect(invalidDetail!.status).toBe(404);
    expect(await invalidDetail!.json()).toEqual({ status: 'error', message: 'Not found' });

    const validDetail = await route('/api/public/competitions/published-competition');
    expect(validDetail!.status).toBe(200);

    const articles = await route('/api/public/competitions/incomplete-competition/articles');
    expect(articles!.status).toBe(200);
    expect((await articles!.json() as any).data).toEqual([
      expect.objectContaining({ slug: 'incomplete-article' }),
    ]);

    const article = await route('/api/public/competitions/incomplete-competition/articles/incomplete-article');
    expect(article!.status).toBe(200);
    expect((await article!.json() as any).data).toEqual(
      expect.objectContaining({ slug: 'incomplete-article' }),
    );
  });

  it('emits a safe structured warning when the production worker invokes the default public handler', async () => {
    seedIncompletePublishedCampaign();
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    const workerFetch = createWorkerFetch({
      handleCors: () => null,
      corsHeaders: () => ({}),
      enforceOriginGuard: () => null,
      verifyToken: () => null,
      jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
      errorResponse: (message: string, status = 400) => Response.json({ status: 'error', message }, { status }),
      internalErrorResponse: () => Response.json({ status: 'error' }, { status: 500 }),
      rateLimit: async () => null,
      logger,
      handlePhieuSubdomain: async () => null,
      handlePublicPhieuApi: async () => null,
      handleCompetitionRoutes: async () => null,
      handleParentPortalRoutes: async () => new Response('not found', { status: 404 }),
    } as any);

    const response = await workerFetch(
      request('/api/public/competitions/incomplete-competition'),
      env as any,
    );

    expect(response.status).toBe(404);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const event = JSON.parse(String(logger.warn.mock.calls[0][0]));
    expect(event).toMatchObject({
      event: 'competition_public_projection_skipped',
      route: '/api/public/competitions/incomplete-competition',
      method: 'GET',
      errorCode: 'COMPETITION_PUBLIC_PAGE_PROJECTION_INVALID',
      context: 'Competition public API',
    });
    expect(JSON.stringify(event)).not.toMatch(/content|student|secret|Nội dung/i);
  });

  it('returns an empty collection when every published projection is incomplete', async () => {
    sqlite.prepare('DELETE FROM competition_rounds WHERE campaign_id = ?').run('campaign-published');

    const listResponse = await route('/api/public/competitions');
    expect(listResponse!.status).toBe(200);
    expect((await listResponse!.json() as any).data).toEqual([]);

    const detailResponse = await route('/api/public/competitions/published-competition');
    expect(detailResponse!.status).toBe(404);
    expect(await detailResponse!.json()).toEqual({ status: 'error', message: 'Not found' });
  });

  it('bounds projection queries while keeping valid rows visible after invalid candidates', async () => {
    for (let index = 0; index < 100; index += 1) {
      const campaignId = `campaign-invalid-${index}`;
      seedCampaign(
        campaignId,
        `aaa-invalid-${String(index).padStart(3, '0')}`,
        'PUBLISHED',
        'DRAFT',
      );
      sqlite.prepare('DELETE FROM competition_rounds WHERE campaign_id = ?').run(campaignId);
    }
    for (let index = 0; index < 100; index += 1) {
      seedCampaign(`campaign-valid-${index}`, `valid-competition-${String(index).padStart(3, '0')}`);
    }

    let prepareCount = 0;
    const countingDb = {
      prepare(sql: string) {
        prepareCount += 1;
        return env.DB.prepare(sql);
      },
    };
    const req = request('/api/public/competitions');
    const response = await handlePublicCompetitionRoutes(
      req,
      { DB: countingDb } as any,
      new URL(req.url).pathname,
      req.method,
      { now: () => new Date(NOW) },
    );
    expect(response!.status).toBe(200);
    expect((await response!.json() as any).data).toHaveLength(100);
    expect(prepareCount).toBeLessThanOrEqual(6);
  });

  it('continues bounded projection pages after runtime-invalid rows to retain later valid rows', async () => {
    for (let index = 0; index < 101; index += 1) {
      seedCampaign(
        `campaign-runtime-invalid-${index}`,
        `aaa_invalid_${String(index).padStart(3, '0')}`,
        'PUBLISHED',
        'DRAFT',
      );
    }

    const req = request('/api/public/competitions');
    const response = await handlePublicCompetitionRoutes(
      req,
      env as any,
      new URL(req.url).pathname,
      req.method,
      { now: () => new Date(NOW) },
    );

    expect(response!.status).toBe(200);
    const body = await response!.json() as any;
    expect(body.data.some((item: any) => item.slug === 'published-competition')).toBe(true);
    expect(body.data.every((item: any) => !item.slug.includes('_'))).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('keeps a round query outage as a sanitized 500 instead of treating it as invalid projection data', async () => {
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };
    const failingRoundsDb = {
      prepare(sql: string) {
        if (sql.includes('FROM competition_rounds')) throw new Error('D1 round outage');
        return env.DB.prepare(sql);
      },
    };
    const req = request('/api/public/competitions');
    const response = await handlePublicCompetitionRoutes(
      req,
      { DB: failingRoundsDb } as any,
      new URL(req.url).pathname,
      req.method,
      { now: () => new Date(NOW), logger },
    );

    expect(response!.status).toBe(500);
    expect(await response!.json()).toMatchObject({
      status: 'error',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps validators representation-safe across time state and empty collection transitions', async () => {
    const beforeEnd = await routeAt(
      '/api/public/competitions/published-competition',
      '2026-08-31T23:59:59.000Z',
    );
    const afterEnd = await routeAt(
      '/api/public/competitions/published-competition',
      '2026-09-01T00:00:00.000Z',
      { headers: { 'If-Modified-Since': beforeEnd!.headers.get('last-modified')! } },
    );
    expect(afterEnd!.status).toBe(200);
    expect((await afterEnd!.json() as any).data.publicState).toBe('ENDED');

    const populated = await route('/api/public/competitions');
    sqlite.prepare(`UPDATE competition_public_pages SET status = 'ARCHIVED' WHERE status = 'PUBLISHED'`).run();
    const emptied = await route('/api/public/competitions', {
      headers: { 'If-Modified-Since': populated!.headers.get('last-modified')! },
    });
    expect(emptied!.status).toBe(200);
    expect((await emptied!.json() as any).data).toEqual([]);
    expect(emptied!.headers.get('etag')).not.toBe(populated!.headers.get('etag'));
  });

  it('includes the full Golden Board representation in the ETag while retaining required versions', async () => {
    const first = await route('/api/public/competitions/published-competition/golden-board');
    const firstEtag = first!.headers.get('etag')!;
    sqlite.prepare(`UPDATE students SET full_name = 'Nguyen Van Binh' WHERE id = 'student-secret-id'`).run();

    const changed = await route('/api/public/competitions/published-competition/golden-board', {
      headers: { 'If-None-Match': firstEtag },
    });
    expect(changed!.status).toBe(200);
    expect(changed!.headers.get('etag')).toContain('2-4-3');
    expect(changed!.headers.get('etag')).not.toBe(firstEtag);
    expect((await changed!.json() as any).data.winners[0].fullName).toBe('Nguyen Van Binh');
  });

  it('uses the public-page service as the shared published list/detail projection authority', async () => {
    const projections = await listPublishedPublicPageProjections(env.DB);
    const detailProjection = await getPublishedPublicPageProjectionBySlug(
      env.DB,
      'published-competition',
    );

    expect(projections).toHaveLength(1);
    expect(detailProjection).toEqual(projections[0]);
    expect(projections[0]).toMatchObject({
      campaignId: 'campaign-published',
      slug: 'published-competition',
      title: 'Competition campaign-published',
      articleSummaryAvailable: true,
    });
    expect(await getPublishedPublicPageProjectionBySlug(env.DB, 'draft-competition')).toBeNull();
  });

  it('checks complete rounds with an indexed per-candidate count instead of a global aggregation', async () => {
    let roundsQuery = '';
    const observingDb = {
      prepare(sql: string) {
        if (sql.includes('FROM competition_rounds')) roundsQuery = sql;
        return env.DB.prepare(sql);
      },
    };

    const projections = await listPublishedPublicPageProjections(observingDb as any, {
      limit: 100,
      requireCompleteRounds: true,
    });

    expect(projections).toHaveLength(1);
    expect(roundsQuery).toContain('WHERE complete_round.campaign_id = page.campaign_id');
    expect(roundsQuery).toContain('SELECT COUNT(*)');
    expect(roundsQuery).not.toMatch(/GROUP BY\s+campaign_id/i);

    const queryPlan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${roundsQuery}`)
      .all(100, 0) as Array<{ detail: string }>;
    const planDetails = queryPlan.map((row) => row.detail).join('\n');
    expect(planDetails).toMatch(
      /SEARCH complete_round USING COVERING INDEX idx_competition_rounds_campaign_window \(campaign_id=\?\)/,
    );
    expect(planDetails).not.toMatch(/SCAN complete_round/i);
  });

  it('rejects mutation verbs safely and registers exactly five public client actions', async () => {
    const mutation = await route('/api/public/competitions/published-competition', { method: 'POST' });
    expect(mutation!.status).toBe(405);
    expect(await mutation!.json()).toEqual({ status: 'error', message: 'Method not allowed' });
    const unknownMutation = await route('/api/public/competitions/published-competition/not-a-route', {
      method: 'POST',
    });
    expect(unknownMutation!.status).toBe(404);
    expect(await unknownMutation!.json()).toEqual({ status: 'error', message: 'Not found' });

    const actions = [
      'list_public_competitions',
      'get_public_competition',
      'list_public_competition_articles',
      'get_public_competition_article',
      'get_public_competition_golden_board',
    ];
    expect(actions.map((action) => resolveApiRoute(action).auth)).toEqual(Array(5).fill('public'));
    expect(resolveApiRoute('get_public_competition').path({ slug: 'hello world/2026' }))
      .toBe('/api/public/competitions/hello%20world%2F2026');
    expect(resolveApiRoute('get_public_competition_article').path({
      slug: 'hello world/2026', articleSlug: 'rules & schedule',
    })).toBe('/api/public/competitions/hello%20world%2F2026/articles/rules%20%26%20schedule');
  });
});
