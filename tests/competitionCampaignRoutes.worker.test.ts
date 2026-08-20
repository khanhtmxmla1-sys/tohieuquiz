// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signJWT } from '../workers/src/utils/jwt';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { createSqliteD1 } from './helpers/sqliteD1';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);
const secret = 'competition-route-test-secret-long-enough';

let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let adminCookie: string;
let teacherCookie: string;

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

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
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      class_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE quizzes (id TEXT PRIMARY KEY);
    CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT);

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

    INSERT INTO teachers (username) VALUES ('admin');
    INSERT INTO teachers (username) VALUES ('teacher-4');
    INSERT INTO teachers (username) VALUES ('teacher-5');

    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-5a', '5A', 'teacher-5', '2026-08-01T00:00:00.000Z');

    INSERT INTO students (
      id, full_name, username, password_hash, class_id, created_at, archived_at
    ) VALUES
      ('student-1', 'An', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z', NULL),
      ('student-2', 'Binh', 'student2', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z', NULL),
      ('student-3', 'Chi', 'student3', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z', NULL),
      ('student-4', 'Dung', 'student4', 'hash', 'class-5a', '2026-08-01T00:00:00.000Z', NULL);
  `);
}

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = adminCookie,
): Promise<Response> {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handleCompetitionRoutes(req, env as any, new URL(req.url).pathname, method);
  if (!response) throw new Error(`Route returned null for ${method} ${path}`);
  return response;
}

const createBody = {
  title: 'Competition 2026-2027',
  schoolYear: '2026-2027',
  timezone: 'Asia/Ho_Chi_Minh',
  audienceRule: { gradeLevels: [4], classIds: ['class-4a', 'class-4b'] },
  eligibilityPolicy: { requiredRounds: 6, requiredPassedRounds: 6 },
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T23:59:59.000Z',
  requestId: 'req_competition_route_create_0001',
};

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  sqlite.exec(migration);
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };

  const adminToken = await signJWT({
    username: 'admin',
    role: 'admin',
    tokenVersion: 1,
    purpose: 'session',
  }, secret);
  const teacherToken = await signJWT({
    username: 'teacher-4',
    role: 'teacher',
    tokenVersion: 1,
    purpose: 'session',
  }, secret);
  adminCookie = `auth_token=${adminToken}`;
  teacherCookie = `auth_token=${teacherToken}`;
});

afterEach(() => {
  sqlite.close();
});

describe('Competition V1 campaign routes', () => {
  it('exposes create, list, detail, and DRAFT patch endpoints', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const listResponse = await request('/api/competitions');
    expect(listResponse.status).toBe(200);
    const listed = await listResponse.json() as any;
    expect(listed.items.map((item: any) => item.id)).toContain(campaignId);

    const detailResponse = await request(`/api/competitions/${campaignId}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as any;
    expect(detail.campaign).toMatchObject({ id: campaignId, title: createBody.title });

    const patchResponse = await request(`/api/competitions/${campaignId}`, 'PATCH', {
      title: 'Competition 2026-2027 Updated',
      requestId: 'req_competition_route_patch_0001',
    });
    expect(patchResponse.status).toBe(200);
    const patched = await patchResponse.json() as any;
    expect(patched.campaign.title).toBe('Competition 2026-2027 Updated');
  });

  it('exposes audience preview, freeze, and cursor list endpoints', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const previewResponse = await request(`/api/competitions/${campaignId}/audience/preview`, 'POST', {
      requestId: 'req_competition_route_preview_0001',
    });
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as any;
    expect(preview.preview).toMatchObject({ matchedCount: 3 });

    const snapshotResponse = await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'req_competition_route_snapshot_0001',
    });
    expect(snapshotResponse.status).toBe(201);
    const snapshot = await snapshotResponse.json() as any;
    expect(snapshot.snapshot).toMatchObject({ status: 'LOCKED', memberCount: 3 });

    const firstPageResponse = await request(`/api/competitions/${campaignId}/audience?limit=2`);
    expect(firstPageResponse.status).toBe(200);
    const firstPage = await firstPageResponse.json() as any;
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPageResponse = await request(
      `/api/competitions/${campaignId}/audience?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = await secondPageResponse.json() as any;
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('rejects teacher mutations while allowing staff reads', async () => {
    const forbidden = await request('/api/competitions', 'POST', createBody, teacherCookie);
    expect(forbidden.status).toBe(403);

    const createResponse = await request('/api/competitions', 'POST', createBody);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const listResponse = await request('/api/competitions', 'GET', undefined, teacherCookie);
    expect(listResponse.status).toBe(200);

    const detailResponse = await request(`/api/competitions/${campaignId}`, 'GET', undefined, teacherCookie);
    expect(detailResponse.status).toBe(200);
  });
});
