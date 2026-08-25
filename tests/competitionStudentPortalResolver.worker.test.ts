// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { signJWT } from '../workers/src/utils/jwt';
import { createSqliteD1 } from './helpers/sqliteD1';
import { competitionRoutes } from '../src/services/api/routes/competitions';
import { ApiError } from '../src/services/api/errors';
import { classifyStudentCompetitionPortalError } from '../src/features/competition/portal/studentCompetitionPortalService';

const secret = 'competition-student-portal-resolver-secret';

let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let student1Cookie: string;
let student2Cookie: string;
let teacherCookie: string;
let adminCookie: string;

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0
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
    CREATE TABLE competition_audience_snapshots (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      member_count INTEGER NOT NULL,
      snapshot_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      locked_at TEXT,
      created_by TEXT NOT NULL
    );
    CREATE TABLE competition_audience_members (
      audience_snapshot_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      grade_level_at_snapshot INTEGER NOT NULL,
      class_id_at_snapshot TEXT NOT NULL,
      student_status_at_snapshot TEXT NOT NULL,
      PRIMARY KEY (audience_snapshot_id, student_id)
    );
    CREATE TABLE competition_rounds (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      opens_at TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      max_attempts INTEGER NOT NULL,
      passing_rule_type TEXT NOT NULL,
      passing_score REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      finalized_at TEXT
    );
    CREATE TABLE competition_round_progress (
      campaign_id TEXT NOT NULL,
      round_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      attempts_used INTEGER NOT NULL,
      best_attempt_id TEXT,
      best_score REAL,
      is_passed INTEGER NOT NULL,
      passed_at TEXT,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (round_id, student_id)
    );
    CREATE TABLE competition_eligibility (
      campaign_id TEXT NOT NULL,
      eligibility_snapshot_version INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      qualified INTEGER NOT NULL,
      reason_codes_json TEXT NOT NULL,
      progress_digest TEXT NOT NULL,
      qualified_at TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (campaign_id, eligibility_snapshot_version, student_id)
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

    INSERT INTO teachers (username) VALUES ('admin'), ('teacher-4');
    INSERT INTO students (id, username, full_name, password_hash, class_id, created_at) VALUES
      ('student-1', 'student1', 'Student One', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'student2', 'Student Two', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z');

    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_snapshot_id,
      starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES
      ('campaign-owned', 'Owned Competition', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE', 'snapshot-owned',
       '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z', 'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
      ('campaign-private', 'Private Competition', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE', 'snapshot-private',
       '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z', 'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');

    INSERT INTO competition_audience_snapshots
      (id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by)
    VALUES
      ('snapshot-owned', 'campaign-owned', 1, 'LOCKED', 1, 'hash-owned', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z', 'admin'),
      ('snapshot-private', 'campaign-private', 1, 'LOCKED', 1, 'hash-private', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z', 'admin');
    INSERT INTO competition_audience_members
      (audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot)
    VALUES
      ('snapshot-owned', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('snapshot-private', 'student-2', 4, 'class-4b', 'ACTIVE');

    INSERT INTO competition_rounds
      (id, campaign_id, round_number, opens_at, closes_at, max_attempts, passing_rule_type, passing_score, status, created_at)
    VALUES
      ('round-owned-1', 'campaign-owned', 1, '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 2,
       'MIN_SCORE', 7, 'OPEN', '2026-08-25T00:00:00.000Z'),
      ('round-private-1', 'campaign-private', 1, '2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 2,
       'MIN_SCORE', 7, 'OPEN', '2026-08-25T00:00:00.000Z');
    INSERT INTO competition_round_progress
      (campaign_id, round_id, student_id, attempts_used, best_score, is_passed, status, version, updated_at)
    VALUES
      ('campaign-owned', 'round-owned-1', 'student-1', 1, 5, 0, 'NOT_PASSED', 1, '2026-09-05T00:00:00.000Z'),
      ('campaign-private', 'round-private-1', 'student-2', 1, 10, 1, 'PASSED', 1, '2026-09-05T00:00:00.000Z');

    INSERT INTO competition_public_pages
      (id, campaign_id, slug, status, hero_title, cta_label, created_by, created_at, updated_at)
    VALUES
      ('page-owned', 'campaign-owned', 'owned-competition', 'DRAFT', 'Owned Competition', 'VÀO THI', 'admin',
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'),
      ('page-private', 'campaign-private', 'private-competition', 'DRAFT', 'Private Competition', 'VÀO THI', 'admin',
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
  `);
}

async function api(pathWithQuery: string, cookie?: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`https://api.test${pathWithQuery}`);
  const headers = new Headers(extraHeaders);
  if (cookie) headers.set('Cookie', cookie);
  const request = new Request(url, { method: 'GET', headers });
  return await handleCompetitionRoutes(request, env as any, url.pathname, 'GET')
    ?? Response.json({ status: 'error', message: 'Not found' }, { status: 404 });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createSchema(sqlite);
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };
  student1Cookie = `auth_token=${await signJWT({ id: 'student-1', username: 'student1', role: 'student', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
  student2Cookie = `auth_token=${await signJWT({ id: 'student-2', username: 'student2', role: 'student', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
  teacherCookie = `auth_token=${await signJWT({ username: 'teacher-4', role: 'teacher', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
  adminCookie = `auth_token=${await signJWT({ username: 'admin', role: 'admin', tokenVersion: 1, purpose: 'session' }, secret, '1d')}`;
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition authenticated student portal slug resolver', () => {
  for (const pageStatus of ['DRAFT', 'PREVIEW'] as const) {
    it(`resolves ${pageStatus} slug for an in-audience Student and returns canonical progress + portal metadata`, async () => {
      sqlite.prepare(`UPDATE competition_public_pages SET status = ? WHERE id = 'page-owned'`).run(pageStatus);

      const response = await api('/api/student/competitions/by-slug/owned-competition', student1Cookie);
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.competition).toMatchObject({
        id: 'campaign-owned',
        title: 'Owned Competition',
        rounds: [expect.objectContaining({
          id: 'round-owned-1', roundNumber: 1, attemptsUsed: 1, bestScore: 5, isPassed: false,
        })],
      });
      expect(body.portal).toEqual({
        campaignId: 'campaign-owned',
        slug: 'owned-competition',
        title: 'Owned Competition',
        schoolYear: '2026-2027',
        publicState: 'ONGOING',
        rounds: [{
          roundId: 'round-owned-1',
          roundNumber: 1,
          title: 'Vòng 1',
          opensAt: '2026-09-01T00:00:00.000Z',
          closesAt: '2026-10-01T00:00:00.000Z',
          state: 'FAILED_RETRY_AVAILABLE',
          attemptCount: 1,
          maxAttempts: 2,
        }],
      });
      expect(JSON.stringify(body.portal)).not.toMatch(/page-owned|createdBy|updatedBy|studentId/);
    });
  }

  it('uses the same generic safe not-found response for an unrelated Student and unknown slug', async () => {
    const unrelated = await api('/api/student/competitions/by-slug/private-competition', student1Cookie);
    const unknown = await api('/api/student/competitions/by-slug/does-not-exist', student1Cookie);
    expect(unrelated.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await unrelated.json()).toEqual(await unknown.json());
    expect(await api('/api/student/competitions/by-slug/private-competition', student2Cookie)).toHaveProperty('status', 200);
  });

  it('rejects Teacher/Admin and anonymous callers at the existing authenticated Student boundary', async () => {
    expect((await api('/api/student/competitions/by-slug/owned-competition', teacherCookie)).status).toBe(403);
    expect((await api('/api/student/competitions/by-slug/owned-competition', adminCookie)).status).toBe(403);
    expect((await api('/api/student/competitions/by-slug/owned-competition')).status).toBe(401);
  });

  it('returns a stable safe retryable error instead of leaking backend failures', async () => {
    sqlite.exec('DROP TABLE competition_public_pages');
    const response = await api('/api/student/competitions/by-slug/owned-competition', student1Cookie);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'COMPETITION_STUDENT_PORTAL_UNAVAILABLE',
    });
  });

  it('registers an encoded authenticated client route and discriminates portal errors', () => {
    const route = competitionRoutes.get_student_competition_by_slug;
    expect(route).toBeDefined();
    expect(route.auth).toBe('session');
    expect(route.method).toBe('GET');
    expect(route.path({ campaignSlug: 'owned competition' })).toBe(
      '/api/student/competitions/by-slug/owned%20competition',
    );

    const preflightRoute = competitionRoutes.preflight_student_competition_round;
    expect(preflightRoute).toBeDefined();
    expect(preflightRoute.auth).toBe('session');
    expect(preflightRoute.method).toBe('POST');
    expect(preflightRoute.path({ campaignId: 'campaign owned', roundId: 'round/1' })).toBe(
      '/api/student/competitions/campaign%20owned/rounds/round%2F1/preflight',
    );
    expect(preflightRoute.body?.('preflight_student_competition_round', {
      campaignId: 'campaign-owned', roundId: 'round-owned-1', studentId: 'student-2',
    })).toEqual({});

    expect(classifyStudentCompetitionPortalError(new ApiError('Not found', 404))).toMatchObject({
      kind: 'NOT_FOUND', status: 404, retryable: false,
    });
    expect(classifyStudentCompetitionPortalError(new ApiError('Network', 0, 'NETWORK_ERROR'))).toMatchObject({
      kind: 'TRANSIENT', code: 'NETWORK_ERROR', retryable: true,
    });
    expect(classifyStudentCompetitionPortalError(new ApiError('Blocked', 409))).toMatchObject({
      kind: 'BUSINESS_RULE', status: 409, retryable: false,
    });
  });

  it('never lets browser-supplied student identity select another Student', async () => {
    const owned = await api(
      '/api/student/competitions/by-slug/owned-competition?studentId=student-2',
      student1Cookie,
      { 'x-student-id': 'student-2' },
    );
    expect(owned.status).toBe(200);
    const ownedBody = await owned.json() as any;
    expect(ownedBody.competition.rounds[0]).toMatchObject({ attemptsUsed: 1, bestScore: 5 });
    expect(JSON.stringify(ownedBody)).not.toContain('student-2');

    const privateAttempt = await api(
      '/api/student/competitions/by-slug/private-competition?studentId=student-2',
      student1Cookie,
      { 'x-student-id': 'student-2' },
    );
    expect(privateAttempt.status).toBe(404);
  });
});
