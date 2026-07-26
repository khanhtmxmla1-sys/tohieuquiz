// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  handleParentHistoryRoutes,
  type ParentHistoryRouteRuntime,
} from '../workers/src/routes/parentPortal/historyRoutes';

const page = { items: [], page: 1, limit: 20, total: 0, totalPages: 0 };
const runtime = (): ParentHistoryRouteRuntime => ({
  authenticate: vi.fn(async () => ({ linkId: 'link-a', studentId: 'student-a', tokenVersion: 1 })),
  listResults: vi.fn(async () => page),
  getResult: vi.fn(async (_studentId, id) => id === 'result-a' ? {
    id: 'result-a', quizId: 'quiz-a', title: 'Toán', subject: 'Toán', score: 8,
    correctCount: 8, totalQuestions: 10, classification: 'Tốt', comment: 'Tốt',
    needsImprovement: null, encouragement: 'Cố gắng', submittedAt: '2026-07-22T00:00:00.000Z',
  } : null),
  listAssignments: vi.fn(async () => page),
  listCertificates: vi.fn(async () => page),
  getCertificateImage: vi.fn(async (_studentId, id) => id === 'certificate-a'
    ? new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
    })
    : null),
});

const request = (path: string) => new Request(`https://phuhuynh.thtohieu.com${path}`);

describe('parent year history isolation', () => {
  it('passes only the session student to every list service', async () => {
    const rt = runtime();
    for (const path of [
      '/api/parent/results?studentId=student-b&page=1',
      '/api/parent/assignments?studentId=student-b&page=1',
      '/api/parent/certificates?studentId=student-b&page=1',
    ]) {
      const response = await handleParentHistoryRoutes(
        request(path),
        { DB: {} } as any,
        new URL(`https://phuhuynh.thtohieu.com${path}`).pathname,
        'GET',
        rt,
      );
      expect(response?.status).toBe(200);
    }
    expect(rt.listResults).toHaveBeenCalledWith('student-a', expect.any(Object));
    expect(rt.listAssignments).toHaveBeenCalledWith('student-a', expect.any(Object));
    expect(rt.listCertificates).toHaveBeenCalledWith('student-a', expect.any(Object));
  });

  it('returns 404 rather than revealing another student result', async () => {
    const rt = runtime();
    const response = await handleParentHistoryRoutes(
      request('/api/parent/results/result-b'),
      { DB: {} } as any,
      '/api/parent/results/result-b',
      'GET',
      rt,
    );
    expect(response?.status).toBe(404);
    expect(rt.getResult).toHaveBeenCalledWith('student-a', 'result-b');
  });

  it('serves a certificate image through the authenticated parent session', async () => {
    const rt = runtime();
    const response = await handleParentHistoryRoutes(
      request('/api/parent/certificates/certificate-a/image'),
      { DB: {} } as any,
      '/api/parent/certificates/certificate-a/image',
      'GET',
      rt,
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Content-Type')).toBe('image/png');
    expect(rt.getCertificateImage).toHaveBeenCalledWith('student-a', 'certificate-a');
  });

  it('does not reveal a certificate image outside the linked student scope', async () => {
    const rt = runtime();
    const response = await handleParentHistoryRoutes(
      request('/api/parent/certificates/certificate-b/image'),
      { DB: {} } as any,
      '/api/parent/certificates/certificate-b/image',
      'GET',
      rt,
    );

    expect(response?.status).toBe(404);
    expect(rt.getCertificateImage).toHaveBeenCalledWith('student-a', 'certificate-b');
  });

  it('never selects or returns answer-level result data', async () => {
    const source = await import('../workers/src/parentPortal/historyService?raw');
    expect(source.default).not.toMatch(/r\.answers|SELECT\s+\*\s+FROM\s+results/i);

    const response = await handleParentHistoryRoutes(
      request('/api/parent/results/result-a'),
      { DB: {} } as any,
      '/api/parent/results/result-a',
      'GET',
      runtime(),
    );
    const payload = await response!.json();
    expect(JSON.stringify(payload)).not.toMatch(/answers|correct_answer/i);
  });
});
