// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { signJWT } from '../workers/src/utils/jwt';
import { createSqliteD1 } from './helpers/sqliteD1';

const secret = 'competition-portal-authorization-secret';
let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let studentCookie: string;
let teacherCookie: string;

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      class_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE competition_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      school_year TEXT NOT NULL,
      timezone TEXT NOT NULL,
      status TEXT NOT NULL,
      audience_rule_json TEXT NOT NULL DEFAULT '{}',
      audience_snapshot_id TEXT,
      eligibility_policy_json TEXT NOT NULL DEFAULT '{}',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_audience_members (
      audience_snapshot_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      grade_level_at_snapshot INTEGER NOT NULL,
      class_id_at_snapshot TEXT NOT NULL,
      student_status_at_snapshot TEXT NOT NULL,
      PRIMARY KEY (audience_snapshot_id, student_id)
    );
    CREATE TABLE competition_public_pages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT,
      hero_image_url TEXT,
      summary TEXT,
      cta_label TEXT NOT NULL,
      seo_title TEXT,
      seo_description TEXT,
      og_image_url TEXT,
      published_at TEXT,
      archived_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

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
      ('competition_v1', 'competition runtime', 1, 'competition-platform', 1,
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
      ('competition_student_portal_v1', 'student portal', 1, 'competition', 1,
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
    INSERT INTO feature_flag_rules VALUES
      ('competition_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}',
       'test fixture', 'test', '2026-08-25T00:00:00.000Z'),
      ('competition_student_portal_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}',
       'test fixture', 'test', '2026-08-25T00:00:00.000Z');
    INSERT INTO teachers (username) VALUES ('teacher-4');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-5a', '5A', 'other-teacher', '2026-08-01T00:00:00.000Z');
    INSERT INTO students (id, username, full_name, password_hash, class_id, created_at) VALUES
      ('student-1', 'student1', 'Student One', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'student2', 'Student Two', 'hash', 'class-5a', '2026-08-01T00:00:00.000Z');
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json, audience_snapshot_id,
      starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES
      ('campaign-private', 'Private Competition', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE',
       '{"gradeLevels":[5],"classIds":["class-5a"]}', 'snapshot-private',
       '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z', 'teacher-4',
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
    INSERT INTO competition_audience_members
      (audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot)
      VALUES ('snapshot-private', 'student-2', 5, 'class-5a', 'ACTIVE');
    INSERT INTO competition_public_pages
      (id, campaign_id, slug, status, hero_title, cta_label, created_by, created_at, updated_at)
      VALUES ('page-private', 'campaign-private', 'private-competition', 'DRAFT',
        'Private Competition', 'VÀO THI', 'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
  `);
}

async function get(path: string, cookie: string): Promise<Response> {
  const request = new Request(`https://api.test${path}`, {
    method: 'GET',
    headers: { Cookie: cookie },
  });
  return await handleCompetitionRoutes(request, env as any, path, 'GET')
    ?? Response.json({ status: 'error', message: 'Not found' }, { status: 404 });
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  createSchema(sqlite);
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };
  studentCookie = `auth_token=${await signJWT({
    id: 'student-1', username: 'student1', role: 'student', tokenVersion: 1, purpose: 'session',
  }, secret, '1d')}`;
  teacherCookie = `auth_token=${await signJWT({
    username: 'teacher-4', role: 'teacher', tokenVersion: 1, purpose: 'session',
  }, secret, '1d')}`;
});

afterEach(() => sqlite.close());

describe('Competition portal authorization safe errors', () => {
  it('lists canonical DRAFT and PREVIEW slugs only for the authenticated Student audience', async () => {
    sqlite.exec(`
      INSERT INTO competition_campaigns (
        id, title, school_year, timezone, status, audience_rule_json, audience_snapshot_id,
        starts_at, ends_at, created_by, created_at, updated_at
      ) VALUES
        ('campaign-owned-no-page', 'Owned campaign without a public page', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE',
         '{}', 'snapshot-owned-no-page', '2026-11-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
         'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
        ('campaign-owned-draft', 'Title must not become the slug', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE',
         '{}', 'snapshot-owned-draft', '2026-10-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
         'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
        ('campaign-owned-preview', 'Another non-slug title', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE',
         '{}', 'snapshot-owned-preview', '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
         'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
      INSERT INTO competition_audience_members
        (audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot)
      VALUES
        ('snapshot-owned-no-page', 'student-1', 4, 'class-4a', 'ACTIVE'),
        ('snapshot-owned-draft', 'student-1', 4, 'class-4a', 'ACTIVE'),
        ('snapshot-owned-preview', 'student-1', 4, 'class-4a', 'ACTIVE');
      INSERT INTO competition_public_pages
        (id, campaign_id, slug, status, hero_title, cta_label, created_by, created_at, updated_at)
      VALUES
        ('page-owned-draft', 'campaign-owned-draft', 'server-owned-draft-slug', 'DRAFT',
         'Draft Competition', 'VÀO THI', 'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
        ('page-owned-preview', 'campaign-owned-preview', 'server-owned-preview-slug', 'PREVIEW',
         'Preview Competition', 'VÀO THI', 'teacher-4', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
    `);

    const response = await get('/api/student/competitions', studentCookie);
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ id: string; slug: string | null }> };
    expect(body.items.map(({ id, slug }) => ({ id, slug }))).toEqual([
      { id: 'campaign-owned-no-page', slug: null },
      { id: 'campaign-owned-draft', slug: 'server-owned-draft-slug' },
      { id: 'campaign-owned-preview', slug: 'server-owned-preview-slug' },
    ]);
    expect(body.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'campaign-private' }),
    ]));

    const anonymous = await get('/api/student/competitions', '');
    expect(anonymous.status).toBe(401);
  });

  it('does not reveal whether an unrelated Student campaign slug exists', async () => {
    const unrelated = await get('/api/student/competitions/by-slug/private-competition', studentCookie);
    const missing = await get('/api/student/competitions/by-slug/does-not-exist', studentCookie);

    expect(unrelated.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await unrelated.json()).toEqual(await missing.json());
  });

  it('does not reveal whether an out-of-scope staff campaign exists', async () => {
    const unrelated = await get('/api/competitions/campaign-private/public-page', teacherCookie);
    const missing = await get('/api/competitions/campaign-missing/public-page', teacherCookie);

    expect(unrelated.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await unrelated.json()).toEqual(await missing.json());
  });
});
