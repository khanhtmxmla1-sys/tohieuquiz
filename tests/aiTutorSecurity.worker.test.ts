import { describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({
    user: { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' },
  })),
}));

import { handleAiTutorRoutes } from '../workers/src/routes/aiTutor';

describe('AI Tutor internal error handling', () => {
  it('does not expose database details in a 500 response', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => { throw new Error('D1_ERROR: no such table questions_private'); },
        }),
      }),
    };
    const request = new Request('https://test/api/ai-tutor/diagnose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'req-ai-tutor-1',
      },
      body: JSON.stringify({ quizId: 'quiz-a', wrongQuestionIds: ['q-1'] }),
    });

    const response = await handleAiTutorRoutes(
      request,
      { DB: db, JWT_SECRET: 'test', CLIPROXY_API: 'https://ai.test', CLIPROXY_TOKEN: 'test' } as any,
      '/api/ai-tutor/diagnose',
      'POST',
    );
    const payload = await response!.json() as any;

    expect(response!.status).toBe(500);
    expect(payload.message).toBe('Internal server error');
    expect(payload.requestId).toBe('req-ai-tutor-1');
    expect(JSON.stringify(payload)).not.toContain('questions_private');
  });
});
