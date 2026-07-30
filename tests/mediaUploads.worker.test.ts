import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = {
  id?: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
};

let currentUser: TestUser = { username: 'teacher-a', role: 'teacher' };
let authFailure: Response | null = null;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authFailure ?? ({ user: currentUser })),
}));

import { handleMediaUploadRoutes } from '../workers/src/routes/mediaUploads';

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const pdfBytes = new TextEncoder().encode('%PDF-1.7\nfixture');

const makeRequest = (
  bytes: Uint8Array,
  contentType: string,
  purpose: string,
  fileName = 'baitap.png',
  extraHeaders: Record<string, string> = {},
) => new Request('https://api.thtohieu.com/api/media/uploads', {
  method: 'POST',
  headers: {
    'Content-Type': contentType,
    'Content-Length': String(bytes.byteLength),
    'X-File-Name': encodeURIComponent(fileName),
    'X-Media-Purpose': purpose,
    ...extraHeaders,
  },
  body: bytes,
});

const makeEnv = () => {
  const put = vi.fn(async () => undefined);
  return {
    env: {
      DB: {},
      JWT_SECRET: 'test-secret',
      OG_IMAGES: { put },
      R2_PUBLIC_URL: 'https://assets.thtohieu.com/',
    } as any,
    put,
  };
};

beforeEach(() => {
  currentUser = { username: 'teacher-a', role: 'teacher' };
  authFailure = null;
  vi.restoreAllMocks();
});

describe('authenticated R2 media uploads', () => {
  it('stores a verified teacher PDF under a server-generated media key', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');
    const { env, put } = makeEnv();

    const response = await handleMediaUploadRoutes(
      makeRequest(pdfBytes, 'application/pdf', 'homework-assignment', 'Đề Toán lớp 4.pdf'),
      env,
      '/api/media/uploads',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload.data.url).toMatch(/^https:\/\/assets\.thtohieu\.com\/media\/homework-assignment\/teacher\/\d{4}\/\d{2}\/11111111-2222-4333-8444-555555555555\.pdf$/);
    expect(payload.data.key).toContain('media/homework-assignment/teacher/');
    expect(payload.data.contentType).toBe('application/pdf');
    expect(payload.data.size).toBe(pdfBytes.byteLength);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(payload.data.key);
    expect(put.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
    expect(put.mock.calls[0][2]).toMatchObject({
      httpMetadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        uploadedBy: 'teacher-a',
        role: 'teacher',
        purpose: 'homework-assignment',
      },
    });
  });

  it('allows a student to upload a verified homework image', async () => {
    currentUser = { id: 'student-1', username: 'student-a', role: 'student' };
    const { env, put } = makeEnv();

    const response = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'homework-submission'),
      env,
      '/api/media/uploads',
      'POST',
    );

    expect(response.status).toBe(201);
    expect(put).toHaveBeenCalledOnce();
    expect(String(put.mock.calls[0][0])).toContain('/student/');
    expect(String(put.mock.calls[0][0])).not.toContain('student-1');
  });

  it('rejects a student attempting to upload quiz-authoring media', async () => {
    currentUser = { id: 'student-1', username: 'student-a', role: 'student' };
    const { env, put } = makeEnv();

    const response = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'quiz-question'),
      env,
      '/api/media/uploads',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects unsupported content types and spoofed file signatures', async () => {
    const first = makeEnv();
    const unsupported = await handleMediaUploadRoutes(
      makeRequest(new TextEncoder().encode('plain text'), 'text/plain', 'homework-assignment', 'notes.txt'),
      first.env,
      '/api/media/uploads',
      'POST',
    );
    expect(unsupported.status).toBe(415);
    expect(first.put).not.toHaveBeenCalled();

    const second = makeEnv();
    const spoofed = await handleMediaUploadRoutes(
      makeRequest(new TextEncoder().encode('not a png'), 'image/png', 'homework-assignment'),
      second.env,
      '/api/media/uploads',
      'POST',
    );
    expect(spoofed.status).toBe(415);
    expect(second.put).not.toHaveBeenCalled();
  });

  it('rejects oversized requests before reading or storing the body', async () => {
    const { env, put } = makeEnv();
    const response = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'homework-assignment', 'large.png', {
        'Content-Length': String(10 * 1024 * 1024 + 1),
      }),
      env,
      '/api/media/uploads',
      'POST',
    );

    expect(response.status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });

  it('fails closed when authentication or R2 configuration is unavailable', async () => {
    const configured = makeEnv();
    authFailure = new Response('{}', { status: 401 });
    const unauthorized = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'homework-assignment'),
      configured.env,
      '/api/media/uploads',
      'POST',
    );
    expect(unauthorized.status).toBe(401);
    expect(configured.put).not.toHaveBeenCalled();

    authFailure = null;
    const missingBinding = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'homework-assignment'),
      { DB: {}, JWT_SECRET: 'test', R2_PUBLIC_URL: '' } as any,
      '/api/media/uploads',
      'POST',
    );
    expect(missingBinding.status).toBe(503);
  });

  it('returns 404/405 for unsupported media routes and methods', async () => {
    const { env } = makeEnv();
    const wrongPath = await handleMediaUploadRoutes(
      makeRequest(pngBytes, 'image/png', 'homework-assignment'),
      env,
      '/api/media/other',
      'POST',
    );
    expect(wrongPath.status).toBe(404);

    const wrongMethod = await handleMediaUploadRoutes(
      new Request('https://api.thtohieu.com/api/media/uploads'),
      env,
      '/api/media/uploads',
      'GET',
    );
    expect(wrongMethod.status).toBe(405);
  });
});
