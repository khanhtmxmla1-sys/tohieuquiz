// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

const authState = vi.hoisted(() => ({
  user: null as JWTPayload | null,
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authState.user
    ? { user: authState.user }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleTestBankRoutes } from '../workers/src/routes/testBank';

class TestBankDatabase {
  queriedTeacherIds: string[] = [];

  prepare(_sql: string) {
    return {
      bind: (teacherId: string) => ({
        all: async () => {
          this.queriedTeacherIds.push(teacherId);
          return {
            results: [{
              id: 'bank-1',
              teacher_id: teacherId,
              question_data: JSON.stringify({ id: 'q-1', question: '2 + 2?' }),
              tags: JSON.stringify(['math']),
              created_at: '2026-07-30T00:00:00.000Z',
            }],
          };
        },
      }),
    };
  }
}

const request = (teacherId: string) => new Request(
  `https://test/api/test-bank/teacher/${encodeURIComponent(teacherId)}`,
  { method: 'GET' },
);

const callRoute = (teacherId: string, db: TestBankDatabase) => handleTestBankRoutes(
  request(teacherId),
  { DB: db } as any,
  `/api/test-bank/teacher/${encodeURIComponent(teacherId)}`,
  'GET',
);

describe('test-bank teacher and admin authorization', () => {
  beforeEach(() => {
    authState.user = null;
  });

  it('allows a teacher to load their own question bank', async () => {
    authState.user = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    const db = new TestBankDatabase();

    const response = await callRoute('teacher-a', db);

    expect(response.status).toBe(200);
    expect(db.queriedTeacherIds).toEqual(['teacher-a']);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: 'bank-1', teacher_id: 'teacher-a', tags: ['math'] }],
    });
  });

  it('rejects a teacher reading another teacher bank', async () => {
    authState.user = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    const db = new TestBankDatabase();

    const response = await callRoute('teacher-b', db);

    expect(response.status).toBe(403);
    expect(db.queriedTeacherIds).toEqual([]);
  });

  it('keeps admin access to a requested question bank', async () => {
    authState.user = { id: 'admin', username: 'admin', role: 'admin' };
    const db = new TestBankDatabase();

    const response = await callRoute('teacher-b', db);

    expect(response.status).toBe(200);
    expect(db.queriedTeacherIds).toEqual(['teacher-b']);
  });
});
