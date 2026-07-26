// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateActivationToken,
  hashActivationToken,
  hashParentPin,
} from '../workers/src/parentPortal/crypto';
import type {
  ParentActivationRecord,
  ParentLinkRecord,
  ParentLinkRepository,
} from '../workers/src/parentPortal/types';
import { handleParentAuthRoutes } from '../workers/src/routes/parentPortal/authRoutes';

const secret = 'test-secret-at-least-32-characters-long';
const now = new Date('2026-07-22T00:00:00.000Z');

const activeLink = (overrides: Partial<ParentLinkRecord> = {}): ParentLinkRecord => ({
  id: 'link-1',
  studentId: 'student-1',
  accessCode: 'ABCDEFG234',
  pinHash: null,
  status: 'PENDING',
  tokenVersion: 1,
  createdBy: 'teacher-a',
  createdAt: '2026-07-21T00:00:00.000Z',
  activatedAt: null,
  revokedAt: null,
  lastAccessedAt: null,
  ...overrides,
});

const repository = (): ParentLinkRepository => {
  let link = activeLink();
  let activation: ParentActivationRecord | null = null;
  return {
    findById: vi.fn(async () => link),
    findActiveByStudentId: vi.fn(async () => link),
    findByAccessCode: vi.fn(async (code) => code === link.accessCode ? link : null),
    findActivationByHash: vi.fn(async (hash) => activation?.tokenHash === hash ? activation : null),
    createLink: vi.fn(async () => link),
    reissueLink: vi.fn(async () => link),
    activateLink: vi.fn(async (_linkId, pinHash, tokenId, at) => {
      link = {
        ...link,
        pinHash,
        status: 'ACTIVE',
        activatedAt: at,
      };
      if (activation?.id === tokenId) activation = { ...activation, consumedAt: at };
    }),
    revokeLink: vi.fn(async () => {
      link = { ...link, status: 'REVOKED', tokenVersion: link.tokenVersion + 1 };
    }),
    touchLastAccessed: vi.fn(async (_linkId, at) => {
      link = { ...link, lastAccessedAt: at };
    }),
    loadProfile: vi.fn(async (studentId) => studentId === 'student-1' ? {
      id: 'student-1',
      fullName: 'Nguyễn Văn An',
      className: '4A9',
      avatar: '',
    } : null),
    __setLink(value: ParentLinkRecord) { link = value; },
    __setActivation(value: ParentActivationRecord | null) { activation = value; },
  } as ParentLinkRepository & {
    __setLink(value: ParentLinkRecord): void;
    __setActivation(value: ParentActivationRecord | null): void;
  };
};

type TestRepository = ParentLinkRepository & {
  __setLink(value: ParentLinkRecord): void;
  __setActivation(value: ParentActivationRecord | null): void;
};

const makeRuntime = (repo: ParentLinkRepository) => ({
  repository: repo,
  now: () => now,
  invalidDelay: vi.fn(async () => undefined),
});

const request = (path: string, method = 'GET', body?: Record<string, unknown>, cookie?: string) => new Request(
  `https://phuhuynh.thtohieu.com${path}`,
  {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  },
);

const installActivation = async (
  repo: TestRepository,
  overrides: Partial<ParentActivationRecord> = {},
) => {
  const rawToken = generateActivationToken();
  const link = activeLink();
  const activation: ParentActivationRecord = {
    id: 'token-1',
    linkId: link.id,
    tokenHash: await hashActivationToken(rawToken),
    expiresAt: '2026-07-29T00:00:00.000Z',
    consumedAt: null,
    createdAt: '2026-07-22T00:00:00.000Z',
    link,
    ...overrides,
  };
  repo.__setLink(activation.link);
  repo.__setActivation(activation);
  return { rawToken, activation };
};

describe('parent activation preview and activation', () => {
  let repo: TestRepository;

  beforeEach(() => {
    repo = repository() as TestRepository;
  });

  it('returns only a safe profile preview', async () => {
    const { rawToken } = await installActivation(repo);
    const response = await handleParentAuthRoutes(
      request(`/api/parent/activation?token=${rawToken}`),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activation',
      'GET',
      makeRuntime(repo),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(payload.data).toEqual({
      student: { fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' },
      expiresAt: '2026-07-29T00:00:00.000Z',
    });
    expect(JSON.stringify(payload)).not.toMatch(/student-1|link-1|ABCDEFG234|tokenHash|token_hash/i);
  });

  it('rejects missing, expired, consumed, and revoked activation tokens', async () => {
    const missing = await handleParentAuthRoutes(
      request('/api/parent/activation'),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activation',
      'GET',
      makeRuntime(repo),
    );
    expect(missing?.status).toBe(400);

    const expiredToken = await installActivation(repo, { expiresAt: '2026-07-21T23:59:59.000Z' });
    const expired = await handleParentAuthRoutes(
      request(`/api/parent/activation?token=${expiredToken.rawToken}`),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activation',
      'GET',
      makeRuntime(repo),
    );
    expect(expired?.status).toBe(410);

    const consumedToken = await installActivation(repo, { consumedAt: '2026-07-21T12:00:00.000Z' });
    const consumed = await handleParentAuthRoutes(
      request(`/api/parent/activation?token=${consumedToken.rawToken}`),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activation',
      'GET',
      makeRuntime(repo),
    );
    expect(consumed?.status).toBe(410);

    const revokedToken = await installActivation(repo, {
      link: activeLink({ status: 'REVOKED' }),
    });
    const revoked = await handleParentAuthRoutes(
      request(`/api/parent/activation?token=${revokedToken.rawToken}`),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activation',
      'GET',
      makeRuntime(repo),
    );
    expect(revoked?.status).toBe(410);
  });

  it('validates the PIN, consumes the token, activates the link, and sets a cookie', async () => {
    const { rawToken } = await installActivation(repo);

    const malformed = await handleParentAuthRoutes(
      request('/api/parent/activate', 'POST', { token: rawToken, pin: '12345' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activate',
      'POST',
      makeRuntime(repo),
    );
    expect(malformed?.status).toBe(400);

    const response = await handleParentAuthRoutes(
      request('/api/parent/activate', 'POST', { token: rawToken, pin: '123456' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/activate',
      'POST',
      makeRuntime(repo),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Set-Cookie')).toContain('parent_auth_token=');
    expect(payload.data.student).toEqual({
      id: 'student-1', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '',
    });
    expect(repo.activateLink).toHaveBeenCalledWith(
      'link-1',
      expect.stringMatching(/^pbkdf2_sha256\$100000\$/),
      'token-1',
      now.toISOString(),
    );
  });
});

describe('parent login, session restore, and logout', () => {
  let repo: TestRepository;

  beforeEach(async () => {
    repo = repository() as TestRepository;
    repo.__setLink(activeLink({
      status: 'ACTIVE',
      pinHash: await hashParentPin('123456'),
      activatedAt: '2026-07-21T00:00:00.000Z',
    }));
  });

  it('returns indistinguishable errors for a wrong code and wrong PIN', async () => {
    const runtime = makeRuntime(repo);
    const wrongCode = await handleParentAuthRoutes(
      request('/api/parent/login', 'POST', { accessCode: 'ZZZZZZZZZZ', pin: '123456' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/login',
      'POST',
      runtime,
    );
    const wrongPin = await handleParentAuthRoutes(
      request('/api/parent/login', 'POST', { accessCode: ' abcdefg234 ', pin: '654321' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/login',
      'POST',
      runtime,
    );

    expect(wrongCode?.status).toBe(401);
    expect(wrongPin?.status).toBe(401);
    await expect(wrongCode?.json()).resolves.toMatchObject({
      error: { code: 'PARENT_LOGIN_INVALID', message: 'Thông tin đăng nhập không đúng.' },
    });
    await expect(wrongPin?.json()).resolves.toMatchObject({
      error: { code: 'PARENT_LOGIN_INVALID', message: 'Thông tin đăng nhập không đúng.' },
    });
    expect(runtime.invalidDelay).toHaveBeenCalledTimes(2);
  });

  it('normalizes the access code and signs an active session', async () => {
    const response = await handleParentAuthRoutes(
      request('/api/parent/login', 'POST', { accessCode: ' abcdefg234 ', pin: '123456' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/login',
      'POST',
      makeRuntime(repo),
    );

    expect(response?.status).toBe(200);
    expect(repo.findByAccessCode).toHaveBeenCalledWith('ABCDEFG234');
    expect(response?.headers.get('Set-Cookie')).toContain('parent_auth_token=');
  });

  it('rejects revoked links and stale token versions on restore', async () => {
    const login = await handleParentAuthRoutes(
      request('/api/parent/login', 'POST', { accessCode: 'ABCDEFG234', pin: '123456' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/login',
      'POST',
      makeRuntime(repo),
    );
    const cookie = login!.headers.get('Set-Cookie')!.split(';')[0];

    repo.__setLink(activeLink({
      status: 'REVOKED',
      pinHash: await hashParentPin('123456'),
      tokenVersion: 2,
    }));
    const revoked = await handleParentAuthRoutes(
      request('/api/parent/session', 'GET', undefined, cookie),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/session',
      'GET',
      makeRuntime(repo),
    );
    expect(revoked?.status).toBe(401);

    repo.__setLink(activeLink({
      status: 'ACTIVE',
      pinHash: await hashParentPin('123456'),
      tokenVersion: 2,
    }));
    const stale = await handleParentAuthRoutes(
      request('/api/parent/session', 'GET', undefined, cookie),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/session',
      'GET',
      makeRuntime(repo),
    );
    expect(stale?.status).toBe(401);
  });

  it('restores an active session and throttles last-access writes to once per hour', async () => {
    const login = await handleParentAuthRoutes(
      request('/api/parent/login', 'POST', { accessCode: 'ABCDEFG234', pin: '123456' }),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/login',
      'POST',
      makeRuntime(repo),
    );
    const cookie = login!.headers.get('Set-Cookie')!.split(';')[0];

    repo.__setLink(activeLink({
      status: 'ACTIVE', pinHash: await hashParentPin('123456'),
      lastAccessedAt: '2026-07-21T20:00:00.000Z',
    }));
    const response = await handleParentAuthRoutes(
      request('/api/parent/session', 'GET', undefined, cookie),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/session',
      'GET',
      makeRuntime(repo),
    );
    expect(response?.status).toBe(200);
    expect(repo.touchLastAccessed).toHaveBeenCalledWith('link-1', now.toISOString());

    vi.mocked(repo.touchLastAccessed).mockClear();
    repo.__setLink(activeLink({
      status: 'ACTIVE', pinHash: await hashParentPin('123456'),
      lastAccessedAt: '2026-07-21T23:30:00.000Z',
    }));
    const recent = await handleParentAuthRoutes(
      request('/api/parent/session', 'GET', undefined, cookie),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/session',
      'GET',
      makeRuntime(repo),
    );
    expect(recent?.status).toBe(200);
    expect(repo.touchLastAccessed).not.toHaveBeenCalled();
  });

  it('logs out with a 204 response and an expired cookie', async () => {
    const response = await handleParentAuthRoutes(
      request('/api/parent/logout', 'POST'),
      { DB: {}, JWT_SECRET: secret } as any,
      '/api/parent/logout',
      'POST',
      makeRuntime(repo),
    );

    expect(response?.status).toBe(204);
    expect(response?.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
