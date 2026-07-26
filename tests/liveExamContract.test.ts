import { describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';
import * as LiveExamService from '../workers/src/services/liveExamService';
import { handleLiveExamRoutes } from '../workers/src/routes/liveExam';

class ContractStatement {
  bind() { return this; }
  async first() { return null; }
  async all() { return { results: [] }; }
  async run() { return { success: true, meta: { changes: 1 } }; }
}

const contractDb = {
  prepare: () => new ContractStatement(),
  batch: async () => [],
};

const endpointCases = [
  ['POST', '/api/live-exam/create', 'teacher'],
  ['GET', '/api/live-exam/live-1', 'teacher'],
  ['POST', '/api/live-exam/live-1/control', 'teacher'],
  ['DELETE', '/api/live-exam/live-1', 'teacher'],
  ['GET', '/api/live-exam/live-1/participants', 'teacher'],
  ['POST', '/api/live-exam/join', 'student'],
  ['GET', '/api/live-exam/live-1/status', 'student'],
  ['POST', '/api/live-exam/live-1/submit', 'student'],
  ['POST', '/api/live-exam/live-1/activity', 'student'],
  ['GET', '/api/live-exam/live-1/results', 'student'],
  ['GET', '/api/live-exam/live-1/chat', 'student'],
  ['POST', '/api/live-exam/live-1/chat/message', 'student'],
  ['POST', '/api/live-exam/live-1/chat/announcement', 'teacher'],
  ['PUT', '/api/live-exam/live-1/chat/settings', 'teacher'],
  ['PUT', '/api/live-exam/live-1/chat/message-1/hide', 'teacher'],
  ['GET', '/api/live-exam/teacher/teacher-a/sessions', 'teacher'],
  ['GET', '/api/live-exam/live-1/analytics', 'teacher'],
  ['POST', '/api/live-exam/live-1/track-timing', 'student'],
] as const;

describe('live exam public contracts', () => {
  it.each(endpointCases)('dispatches %s %s', async (method, path, role) => {
    currentUser = role === 'student'
      ? { id: 'student-a', username: 'student-a', role: 'student' }
      : { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    const request = new Request(`https://test${path}`, {
      method,
      headers: method === 'GET' || method === 'DELETE' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
    });

    const response = await handleLiveExamRoutes(
      request,
      { DB: contractDb, JWT_SECRET: 'test' } as any,
      path,
      method,
    );
    const payload = await response.json() as { message?: string };

    expect(payload.message).not.toBe('Live Exam endpoint not found');
  });

  it('authenticates a chat read exactly once before session lookup', async () => {
    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    vi.mocked(verifyJWTMiddleware).mockClear();
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-1/chat'),
      { DB: contractDb, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-1/chat',
      'GET',
    );

    expect(response.status).toBe(404);
    expect(verifyJWTMiddleware).toHaveBeenCalledTimes(1);
  });

  it('resolves a legacy student token through the username before reading chat', async () => {
    currentUser = { username: 'student-a', role: 'student' };
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes('SELECT id FROM students')) return { id: 'student-id' };
            if (sql.includes('FROM live_exam_sessions s')) {
              return {
                id: 'live-1', title: 'Exam', quiz_id: 'quiz-1', teacher_id: 'teacher-a',
                class_id: 'class-a', duration: 30, settings: '{}', status: 'waiting',
                access_code: 'ABC123', created_at: '', updated_at: '', chat_enabled: 1,
              };
            }
            if (sql.includes('live_exam_participants')) return { id: 'participant-a' };
            if (sql.includes('chat_enabled')) return { chat_enabled: 1 };
            return null;
          },
          all: async () => ({ results: [] }),
        }),
      }),
      batch: async () => [],
    };

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-1/chat'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-1/chat',
      'GET',
    );

    expect(response.status).toBe(200);
  });

  it('keeps the service barrel runtime API stable', () => {
    expect(Object.keys(LiveExamService).sort()).toEqual([
      'LiveExamServiceError',
      'calculateScoresAndClose',
      'checkAndAutoCloseExpiredExams',
      'createLiveExam',
      'createWaitingRoomChatMessage',
      'deleteLiveExam',
      'endExamEarly',
      'generateAccessCode',
      'getLiveExamByAccessCode',
      'getLiveExamById',
      'getParticipants',
      'getWaitingRoomChat',
      'hideWaitingRoomChatMessage',
      'joinSession',
      'markInactiveParticipants',
      'openSession',
      'startExam',
      'submitAnswers',
      'updateActivity',
      'updateWaitingRoomChatEnabled',
    ]);
  });
});
