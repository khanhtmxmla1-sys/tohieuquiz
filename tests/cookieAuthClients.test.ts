// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchClassOptions } from '../src/features/certificates/certificate-batch-modal/certificateBatchApi';
import { fetchCertificateImageBlob } from '../src/features/certificates/useCertificates';
import { analyticsService } from '../src/features/analytics/services/analyticsService';
import { fetchAnalytics } from '../src/services/liveExamAnalyticsService';
import { createLiveExam } from '../src/services/liveExamService';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const assertCookieRequest = (init?: RequestInit) => {
  expect(init?.credentials).toBe('include');
  const headers = new Headers(init?.headers);
  expect(headers.has('Authorization')).toBe(false);
};

describe('cookie-only feature clients', () => {
  it('loads certificate data without a readable bearer token', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(fetchClassOptions()).resolves.toEqual([]);
    assertCookieRequest(fetchMock.mock.calls[0]?.[1]);
  });

  it('loads protected certificate images with cookie credentials only', async () => {
    fetchMock.mockResolvedValue(new Response(new Blob(['png']), { status: 200 }));

    await expect(fetchCertificateImageBlob('/api/certificates/cert-1/image')).resolves.toBeInstanceOf(Blob);
    assertCookieRequest(fetchMock.mock.calls[0]?.[1]);
  });

  it('creates live exams through the HttpOnly cookie session', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      session: { id: 'live-1' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await createLiveExam({ title: 'Kiểm tra', quizId: 'quiz-1', classId: 'class-1', duration: 30 } as any);
    assertCookieRequest(fetchMock.mock.calls[0]?.[1]);
  });

  it('loads live and class analytics without Authorization headers', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ analytics: { session: { id: 'live-1' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: { classId: 'class-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    await fetchAnalytics('live-1');
    assertCookieRequest(fetchMock.mock.calls[0]?.[1]);
    await analyticsService.getClassAnalytics('class-1');
    assertCookieRequest(fetchMock.mock.calls[1]?.[1]);
  });
});
