// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { handlePublicCompetitionRoutes } from '../workers/src/routes/publicCompetitions';
import { signJWT } from '../workers/src/utils/jwt';
import { createSqliteD1 } from './helpers/sqliteD1';

const portalMigration = readFileSync(
  new URL('../workers/migrations/0079_competition_public_portal.sql', import.meta.url),
  'utf8',
);
const secret = 'competition-portal-privacy-regression-secret';
const NOW = '2026-08-25T06:00:00.000Z';

let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

const PUBLIC_DTO_FIXTURES = [
  {
    slug: 'published-competition', title: 'Hội thi 2026', summary: 'Sáu vòng thi.',
    schoolYear: '2026-2027', publicState: 'ONGOING', startsAt: NOW, endsAt: '2027-05-31T23:59:59.000Z',
    timezone: 'Asia/Ho_Chi_Minh', hero: { title: 'Hội thi 2026' }, cta: { label: 'VÀO THI' },
    rounds: [{ roundNumber: 1, title: 'Vòng 1', opensAt: NOW, closesAt: '2026-08-26T00:00:00.000Z', state: 'OPEN' }],
    articleSummaryAvailable: true, goldenBoardAvailable: true,
  },
  {
    slug: 'the-le', title: 'Thể lệ', summary: 'Tóm tắt.', content: 'Nội dung công khai.',
    type: 'RULES', publishedAt: NOW,
  },
  {
    winners: [{ fullName: 'Nguyễn Văn An', className: '4A', schoolName: 'Trường Tiểu học Tô Hiệu', gradeLevel: 4, awardCode: 'GOLD', awardLabel: 'Giải Nhất' }],
    publicationVersion: 1, rankingVersion: 1, awardRuleVersion: 1, publishedAt: NOW,
  },
] as const;

const forbiddenPublicKey = (key: string): boolean => {
  const normalized = key.replace(/[_-]/g, '').toLowerCase();
  const explicitlyForbidden = new Set([
    'username', 'studentid', 'email', 'phone', 'guardian', 'parent',
    'answer', 'answers', 'attempt', 'attempts', 'incident', 'incidents',
    'retest', 'retests', 'reconcile', 'room', 'roomname', 'roomcode',
    'accesscode', 'storagepath', 'storagekey', 'storageurl', 'score',
    'rank', 'correctcount', 'wrongcount', 'result',
  ]);
  return normalized === 'id'
    || normalized.endsWith('id')
    || explicitlyForbidden.has(normalized)
    || normalized.includes('guardian')
    || normalized.includes('parent')
    || normalized.includes('storage');
};

function assertPublicDtoPrivacy(value: unknown, path = '$', visited = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicDtoPrivacy(item, `${path}[${index}]`, visited));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPublicKey(key)) throw new Error(`Forbidden public field at ${path}.${key}`);
    assertPublicDtoPrivacy(child, `${path}.${key}`, visited);
  }
}

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
      timezone TEXT NOT NULL, status TEXT NOT NULL, audience_rule_json TEXT NOT NULL DEFAULT '{}',
      audience_snapshot_id TEXT, eligibility_policy_json TEXT NOT NULL DEFAULT '{}',
      starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_audience_members (
      audience_snapshot_id TEXT NOT NULL, student_id TEXT NOT NULL,
      grade_level_at_snapshot INTEGER NOT NULL DEFAULT 4, class_id_at_snapshot TEXT NOT NULL DEFAULT 'class-4a',
      student_status_at_snapshot TEXT NOT NULL DEFAULT 'ACTIVE',
      PRIMARY KEY (audience_snapshot_id, student_id)
    );
    CREATE TABLE competition_rounds (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, round_number INTEGER NOT NULL,
      opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, max_attempts INTEGER NOT NULL,
      passing_score REAL NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE competition_round_progress (
      round_id TEXT NOT NULL, student_id TEXT NOT NULL, attempts_used INTEGER NOT NULL DEFAULT 0,
      best_score REAL, is_passed INTEGER NOT NULL DEFAULT 0, status TEXT,
      PRIMARY KEY (round_id, student_id)
    );
    CREATE TABLE competition_eligibility (
      campaign_id TEXT NOT NULL, student_id TEXT NOT NULL, eligibility_snapshot_version INTEGER NOT NULL,
      qualified INTEGER NOT NULL, reason_codes_json TEXT NOT NULL DEFAULT '[]', qualified_at TEXT,
      PRIMARY KEY (campaign_id, student_id, eligibility_snapshot_version)
    );
    CREATE TABLE competition_school_exam_events (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, eligibility_snapshot_version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL, exam_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
      ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME', exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM',
      capacity_profile_id TEXT, created_by TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '', published_at TEXT
    );
    CREATE TABLE competition_school_exam_publications (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, version INTEGER NOT NULL,
      ranking_version INTEGER, status TEXT NOT NULL, published_at TEXT
    );
    CREATE TABLE competition_school_exam_publication_results (
      id TEXT PRIMARY KEY, publication_id TEXT NOT NULL, event_id TEXT NOT NULL,
      publication_version INTEGER NOT NULL, ranking_version INTEGER NOT NULL,
      student_id TEXT NOT NULL, original_class_id TEXT NOT NULL, grade_level INTEGER NOT NULL,
      rank_event INTEGER NOT NULL, rank_grade INTEGER NOT NULL, rank_class INTEGER NOT NULL DEFAULT 1,
      score REAL NOT NULL DEFAULT 0, correct_count INTEGER, time_taken INTEGER,
      published_at TEXT NOT NULL DEFAULT ''
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
      ('class-4a', '4A', 'teacher-4', '${NOW}'),
      ('class-5a', '5A', 'other-teacher', '${NOW}');
    INSERT INTO students (id, username, full_name, password_hash, class_id, created_at) VALUES
      ('student-1', 'student1', 'Nguyễn Văn An', 'hash', 'class-4a', '${NOW}'),
      ('student-2', 'student2', 'Student Two', 'hash', 'class-5a', '${NOW}');
  `);
  db.exec(portalMigration);
}

function seedCampaign(
  id: string,
  slug: string,
  status: 'ACTIVE' | 'DRAFT',
  audienceSnapshotId: string | null,
  audienceRule: { gradeLevels: number[]; classIds?: string[] },
): void {
  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json, audience_snapshot_id,
      starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (?, ?, '2026-2027', 'Asia/Ho_Chi_Minh', ?, ?, ?,
      '2026-08-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z', 'admin', ?, ?)
  `).run(id, `Campaign ${id}`, status, JSON.stringify(audienceRule), audienceSnapshotId, NOW, NOW);
  sqlite.prepare(`
    INSERT INTO competition_public_pages (
      id, campaign_id, slug, status, hero_title, hero_subtitle, hero_image_url, summary,
      cta_label, seo_title, seo_description, og_image_url, published_at, archived_at,
      created_by, created_at, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'Cùng tranh tài', NULL, 'Sáu vòng thi.', 'VÀO THI',
      'Hội thi 2026', 'Thông tin hội thi', NULL, ?, NULL, 'admin', ?, NULL, ?)
  `).run(
    `page-${id}`, id, slug, status === 'ACTIVE' ? 'PUBLISHED' : 'DRAFT',
    `Hero ${id}`, status === 'ACTIVE' ? NOW : null, NOW, NOW,
  );
}

function seedCompetitionData(): void {
  seedCampaign('campaign-public', 'published-competition', 'ACTIVE', 'snapshot-public', { gradeLevels: [4], classIds: ['class-4a'] });
  seedCampaign('campaign-private', 'private-competition', 'ACTIVE', 'snapshot-private', { gradeLevels: [5], classIds: ['class-5a'] });
  seedCampaign('campaign-admin', 'admin-draft-competition', 'DRAFT', null, { gradeLevels: [4], classIds: ['class-4a'] });
  sqlite.prepare(`
    INSERT INTO competition_audience_members (audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot)
    VALUES ('snapshot-public', 'student-1', 4, 'class-4a')
  `).run();

  const round = sqlite.prepare(`
    INSERT INTO competition_rounds (id, campaign_id, round_number, opens_at, closes_at, max_attempts, passing_score, status)
    VALUES (?, 'campaign-public', ?, ?, ?, 3, 7, 'OPEN')
  `);
  for (let number = 1; number <= 6; number += 1) {
    round.run(`round-${number}`, number, NOW, '2027-01-01T00:00:00.000Z');
  }
  const privateRound = sqlite.prepare(`
    INSERT INTO competition_rounds (id, campaign_id, round_number, opens_at, closes_at, max_attempts, passing_score, status)
    VALUES (?, 'campaign-private', ?, ?, ?, 3, 7, 'OPEN')
  `);
  for (let number = 1; number <= 6; number += 1) {
    privateRound.run(`private-round-${number}`, number, NOW, '2027-01-01T00:00:00.000Z');
  }

  sqlite.prepare(`
    INSERT INTO competition_articles (
      id, campaign_id, title, slug, summary, cover_image_url, content, type, status,
      published_at, created_by, created_at, updated_by, updated_at
    ) VALUES ('article-public', 'campaign-public', 'Thể lệ', 'the-le', 'Tóm tắt.', NULL,
      'Nội dung công khai.', 'RULES', 'PUBLISHED', ?, 'admin', ?, NULL, ?)
  `).run(NOW, NOW, NOW);
  sqlite.prepare(`
    INSERT INTO competition_school_exam_events (id, campaign_id, title, exam_date, status, published_at)
    VALUES ('event-public', 'campaign-public', 'Thi cấp trường', ?, 'PUBLISHED', ?)
  `).run(NOW, NOW);
  sqlite.prepare(`
    INSERT INTO competition_award_rule_versions (id, campaign_id, version, status, activated_at, created_by, created_at, updated_at)
    VALUES ('rules-public-v1', 'campaign-public', 1, 'DRAFT', NULL, 'admin', ?, ?)
  `).run(NOW, NOW);
  sqlite.prepare(`
    INSERT INTO competition_award_rules (
      id, campaign_id, version, scope, grade_level, rank_from, rank_to, award_code, award_label, sort_order, created_by, created_at, updated_at
    ) VALUES ('rule-public-1', 'campaign-public', 1, 'EVENT', NULL, 1, 1, 'GOLD', 'Giải Nhất', 1, 'admin', ?, ?)
  `).run(NOW, NOW);
  sqlite.prepare(`
    UPDATE competition_award_rule_versions
    SET status = 'ACTIVE', activated_at = ?, updated_at = ?
    WHERE id = 'rules-public-v1'
  `).run(NOW, NOW);
  sqlite.prepare(`
    INSERT INTO competition_golden_board_configs (
      id, campaign_id, source_event_id, enabled, display_mode, title, award_rule_version, updated_by, updated_at
    ) VALUES ('board-public', 'campaign-public', 'event-public', 1, 'AWARD_WINNERS', 'Bảng vàng', 1, 'admin', ?)
  `).run(NOW);
  sqlite.prepare(`
    INSERT INTO competition_school_exam_publications (id, event_id, version, ranking_version, status, published_at)
    VALUES ('publication-public-v1', 'event-public', 1, 1, 'PUBLISHED', ?)
  `).run(NOW);
  sqlite.prepare(`
    INSERT INTO competition_school_exam_publication_results (
      id, publication_id, event_id, publication_version, ranking_version, student_id,
      original_class_id, grade_level, rank_event, rank_grade, rank_class, score, correct_count, time_taken, published_at
    ) VALUES ('result-internal-1', 'publication-public-v1', 'event-public', 1, 1,
      'student-1', 'class-4a', 4, 1, 1, 1, 10, 20, 100, ?)
  `).run(NOW);
  sqlite.prepare(`UPDATE feature_flags SET enabled = 1 WHERE flag_key IN (
    'competition_public_portal_read_v1', 'competition_student_portal_v1',
    'competition_golden_board_v1', 'competition_public_content_admin_v1'
  )`).run();
}

function cookieFor(payload: { id?: string; username: string; role: 'student' | 'teacher' | 'admin' }): Promise<string> {
  return signJWT({ ...payload, tokenVersion: 1, purpose: 'session' }, secret, '1d')
    .then(token => `auth_token=${token}`);
}

async function competitionRoute(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
): Promise<Response> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const request = new Request(`https://api.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return await handleCompetitionRoutes(request, env as any, path, method)
    ?? new Response(JSON.stringify({ status: 'error', message: 'Not found' }), { status: 404 });
}

async function publicRoute(path: string): Promise<Response> {
  const request = new Request(`https://api.test${path}`);
  return (await handlePublicCompetitionRoutes(
    request,
    env as any,
    path,
    'GET',
    { now: () => new Date(NOW) },
  ))!;
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  createSchema(sqlite);
  seedCompetitionData();
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };
  adminCookie = await cookieFor({ username: 'admin', role: 'admin' });
  teacherCookie = await cookieFor({ username: 'teacher-4', role: 'teacher' });
  studentCookie = await cookieFor({ id: 'student-1', username: 'student1', role: 'student' });
});

afterEach(() => sqlite.close());

describe('Competition portal privacy and authorization acceptance matrix', () => {
  it('recursively rejects forbidden fields and scans every public DTO fixture', async () => {
    expect(() => assertPublicDtoPrivacy({ nested: [{ studentId: 'internal' }] })).toThrow(/studentId/);
    for (const fixture of PUBLIC_DTO_FIXTURES) assertPublicDtoPrivacy(fixture);

    for (const path of [
      '/api/public/competitions',
      '/api/public/competitions/published-competition',
      '/api/public/competitions/published-competition/articles',
      '/api/public/competitions/published-competition/articles/the-le',
      '/api/public/competitions/published-competition/golden-board',
    ]) {
      const response = await publicRoute(path);
      const body = await response.json() as any;
      expect(response.status, path).toBe(200);
      expect(body.status).toBe('success');
      assertPublicDtoPrivacy(body.data, path);
    }
  });

  it('keeps anonymous public reads separate from authenticated Student and staff namespaces', async () => {
    expect((await publicRoute('/api/public/competitions')).status).toBe(200);

    expect((await competitionRoute('/api/student/competitions/by-slug/published-competition')).status).toBe(401);
    expect((await competitionRoute('/api/competitions/campaign-public/public-page')).status).toBe(401);

    const own = await competitionRoute('/api/student/competitions/by-slug/published-competition', 'GET', undefined, studentCookie);
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ portal: { campaignId: 'campaign-public', slug: 'published-competition' } });

    const unrelated = await competitionRoute('/api/student/competitions/by-slug/private-competition', 'GET', undefined, studentCookie);
    const missing = await competitionRoute('/api/student/competitions/by-slug/does-not-exist', 'GET', undefined, studentCookie);
    expect(unrelated.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await unrelated.json()).toEqual(await missing.json());
  });

  it('allows scoped Teacher staff reads, keeps mutations Admin-only, and blocks student attempts for both staff roles', async () => {
    const teacherRead = await competitionRoute('/api/competitions/campaign-public/public-page', 'GET', undefined, teacherCookie);
    expect(teacherRead.status).toBe(200);
    expect(await teacherRead.json()).toMatchObject({ publicPage: { campaignId: 'campaign-public', status: 'PUBLISHED' } });

    const teacherMutation = await competitionRoute('/api/competitions/campaign-public/public-page', 'PUT', {
      heroTitle: 'Teacher must not edit', requestId: 'privacy-teacher-edit-0001',
    }, teacherCookie);
    expect(teacherMutation.status).toBe(403);

    const adminMutation = await competitionRoute('/api/competitions/campaign-admin/public-page', 'PUT', {
      heroTitle: 'Admin can edit', requestId: 'privacy-admin-edit-0001',
    }, adminCookie);
    expect(adminMutation.status).toBe(200);
    expect(await adminMutation.json()).toMatchObject({ publicPage: { heroTitle: 'Admin can edit' } });

    const attemptPath = '/api/student/competitions/campaign-public/rounds/round-1/attempts';
    for (const cookie of [teacherCookie, adminCookie]) {
      const response = await competitionRoute(attemptPath, 'POST', {
        campaignId: 'campaign-public', roundId: 'round-1', requestId: 'privacy-attempt-0001',
      }, cookie);
      expect(response.status).toBe(403);
    }
  });

  it('withholds the Student official result until both event and publication are published', async () => {
    sqlite.prepare(`
      UPDATE competition_school_exam_events
      SET status = 'DRAFT', published_at = NULL
      WHERE id = 'event-public'
    `).run();
    sqlite.prepare(`
      UPDATE competition_school_exam_publications
      SET status = 'PREPARED', published_at = NULL
      WHERE id = 'publication-public-v1'
    `).run();

    const withheld = await competitionRoute(
      '/api/student/competitions/campaign-public/official-result', 'GET', undefined, studentCookie,
    );
    expect(withheld.status).toBe(404);
    expect(await withheld.json()).toMatchObject({
      status: 'error',
      message: 'SCHOOL_EXAM_PUBLICATION_NOT_FOUND',
    });

    sqlite.prepare(`
      UPDATE competition_school_exam_events
      SET status = 'PUBLISHED', published_at = ?
      WHERE id = 'event-public'
    `).run(NOW);
    sqlite.prepare(`
      UPDATE competition_school_exam_publications
      SET status = 'PUBLISHED', published_at = ?
      WHERE id = 'publication-public-v1'
    `).run(NOW);

    const published = await competitionRoute(
      '/api/student/competitions/campaign-public/official-result', 'GET', undefined, studentCookie,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({
      result: {
        studentId: 'student-1',
        score: 10,
        publicationVersion: 1,
        rankEvent: 1,
      },
    });
  });
});
