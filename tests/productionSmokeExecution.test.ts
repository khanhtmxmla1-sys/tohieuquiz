import { readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runProductionSmoke } from '../scripts/run-production-smoke.mjs';

const output = 'reports/production-smoke-test.json';
const site = 'https://www.thtohieu.com';
const apex = 'https://thtohieu.com';
const api = 'https://api.thtohieu.com';
const parent = 'https://phuhuynh.thtohieu.com';
const html = '<!doctype html><title>Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz</title><div id="root"></div>';
const securityHeaders = {
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'",
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json', ...headers } },
);

const fakeFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
  const method = init?.method || 'GET';
  const headers = new Headers(init?.headers);
  const authenticated = Boolean(headers.get('cookie'));

  if (url.origin === site && url.pathname === '/') return new Response(html, { headers: securityHeaders });
  if (url.origin === apex && url.pathname === '/') return new Response('', { status: 308, headers: { location: site } });
  if (url.origin === parent && url.pathname === '/login') return new Response(html, { headers: securityHeaders });
  if (url.origin === site && url.pathname === '/api/health') return json({ status: 'ok' });
  if (url.origin === api && url.pathname === '/api/health') {
    const origin = headers.get('origin');
    return json({ status: 'ok' }, 200, origin === site ? { 'access-control-allow-origin': site } : {});
  }
  if (url.origin === api && method === 'POST' && ['/api/login', '/api/student-login', '/api/parent/login'].includes(url.pathname)) {
    return json({ status: 'success', data: {} }, 200, { 'set-cookie': 'smoke_session=opaque; Path=/; HttpOnly' });
  }
  if (url.origin === api && [
    '/api/admin/operations', '/api/teacher/action-center', '/api/student-profile', '/api/parent/dashboard',
  ].includes(url.pathname)) {
    if (!authenticated) return json({ status: 'error' }, 401);
    const extra = url.pathname === '/api/admin/operations' ? { 'cache-control': 'no-store' } : {};
    return json({ status: 'success', data: {} }, 200, extra);
  }
  return json({ status: 'error' }, 404);
});

afterEach(() => {
  rmSync(output, { force: true });
  fakeFetch.mockClear();
});

describe('production smoke execution', () => {
  it('runs public-only coverage without credentials, POST requests, cookies, auth, or AI checks', async () => {
    const spawn = vi.fn();
    const code = await runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--public-only', '--skip-browser', '--output', output,
    ], { fetchImpl: fakeFetch as typeof fetch, spawn, env: {} });

    expect(code).toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({
      status: 'ready',
      coverage: 'public',
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(fakeFetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
    expect(fakeFetch.mock.calls.every(([, init]) => !new Headers(init?.headers).get('cookie'))).toBe(true);
    expect(fakeFetch.mock.calls.some(([input]) => String(input).includes('/teacher-ai-quota'))).toBe(false);
  });

  it('rejects incompatible public-only settings before the first request or browser spawn', async () => {
    const fetchImpl = vi.fn();
    const spawn = vi.fn();
    const publicArgs = [
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--public-only', '--skip-browser', '--output', output,
    ];

    await expect(runProductionSmoke([...publicArgs, '--ai-smoke'], {
      fetchImpl: fetchImpl as typeof fetch,
      spawn,
      env: {},
    })).rejects.toThrow('cannot be combined with --public-only');
    await expect(runProductionSmoke(publicArgs, {
      fetchImpl: fetchImpl as typeof fetch,
      spawn,
      env: { SMOKE_ADMIN_USERNAME: 'fixture-admin' },
    })).rejects.toThrow(/public-only mode cannot use protected smoke credentials/i);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects credentialed smoke without --skip-browser before any request or spawn', async () => {
    const fetchImpl = vi.fn();
    const spawn = vi.fn();
    await expect(runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--output', output,
    ], {
      fetchImpl: fetchImpl as typeof fetch,
      spawn,
      env: { SMOKE_ADMIN_USERNAME: 'fixture-admin' },
    })).rejects.toThrow('requires --skip-browser');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('allows non-credentialed public localhost fixtures only when local mode is explicit', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }));
    const code = await runProductionSmoke([
      '--site', 'http://127.0.0.1:3001',
      '--apex', 'http://127.0.0.1:3001',
      '--api', 'http://127.0.0.1:8787',
      '--parent', 'http://127.0.0.1:3001',
      '--public-only', '--allow-local', '--skip-browser', '--output', output,
    ], { fetchImpl: fetchImpl as typeof fetch, env: {} });

    expect(code).toBe(1);
    expect(fetchImpl).toHaveBeenCalled();
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({ coverage: 'public', status: 'blocked' });
  });

  it('uses the canonical apex when production mode omits --apex', async () => {
    const code = await runProductionSmoke([
      '--site', site, '--api', api, '--parent', parent,
      '--production-targets', '--public-only', '--skip-browser', '--output', output,
    ], { fetchImpl: fakeFetch as typeof fetch, env: {} });

    const report = JSON.parse(readFileSync(output, 'utf8'));
    expect(code).toBe(0);
    expect(report.targets.apex).toBe(apex);
  });

  it('does not follow a login redirect or send credentials to a second host', async () => {
    const loginRequests: string[] = [];
    const redirectFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
      if (init?.method === 'POST') {
        loginRequests.push(url.href);
        return new Response('', { status: 302, headers: { location: 'https://hostile.invalid/login' } });
      }
      return fakeFetch(input, init);
    });
    const env = {
      SMOKE_ADMIN_USERNAME: 'admin-private', SMOKE_ADMIN_PASSWORD: 'admin-password',
      SMOKE_TEACHER_USERNAME: 'teacher-private', SMOKE_TEACHER_PASSWORD: 'teacher-password',
      SMOKE_STUDENT_USERNAME: 'student-private', SMOKE_STUDENT_PASSWORD: 'student-password',
      SMOKE_PARENT_ACCESS_CODE: 'PARENTCODE', SMOKE_PARENT_PIN: '123456',
    };

    const code = await runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--skip-browser', '--output', output,
    ], { fetchImpl: redirectFetch as typeof fetch, env });

    expect(code).toBe(1);
    expect(loginRequests).toHaveLength(4);
    expect(redirectFetch.mock.calls.some(([input]) => String(input).includes('hostile.invalid'))).toBe(false);
  });

  it.each([
    ['HTTP 503', new Response('', { status: 503 })],
    ['noindex', new Response(html, { headers: { ...securityHeaders, 'x-robots-tag': 'noindex' } })],
  ])('treats public maintenance response (%s) as blocked, not ready', async (_label, maintenanceResponse) => {
    const maintenanceFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
      if (url.origin === site && url.pathname === '/') return maintenanceResponse.clone();
      return fakeFetch(input, init);
    });

    const code = await runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--public-only', '--skip-browser', '--output', output,
    ], { fetchImpl: maintenanceFetch as typeof fetch, env: {} });

    expect(code).toBe(1);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({
      status: 'blocked',
      coverage: 'public',
    });
  });

  it('rejects an unapproved credentialed target and never allows local mode with secrets', async () => {
    const fetchImpl = vi.fn();
    const env = {
      SMOKE_ADMIN_USERNAME: 'fixture-admin',
      SMOKE_ADMIN_PASSWORD: 'fixture-password',
    };

    await expect(runProductionSmoke([
      '--site', site,
      '--apex', apex,
      '--api', 'https://api.thtohieu.com.untrusted.example',
      '--parent', parent,
      '--skip-browser',
      '--output', output,
    ], { fetchImpl: fetchImpl as typeof fetch, env })).rejects.toThrow('Unapproved production smoke target');

    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--allow-local', '--skip-browser', '--output', output,
    ], { fetchImpl: fetchImpl as typeof fetch, env })).rejects.toThrow('cannot be used with --allow-local');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['site', apex],
    ['apex', site],
    ['api', site],
    ['parent', site],
  ])('rejects a wrong canonical origin for the %s role before outbound work', async (role, wrongTarget) => {
    const fetchImpl = vi.fn();
    const args = [
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--production-targets', '--skip-browser', '--output', output,
    ];
    args[args.indexOf(`--${role}`) + 1] = wrongTarget;

    await expect(runProductionSmoke(args, {
      fetchImpl: fetchImpl as typeof fetch,
      env: { SMOKE_ADMIN_USERNAME: 'fixture-admin', SMOKE_ADMIN_PASSWORD: 'fixture-password' },
    })).rejects.toThrow('Unapproved production smoke target');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('checks every role and writes a credential-free ready report', async () => {
    const env = {
      SMOKE_ADMIN_USERNAME: 'admin-private', SMOKE_ADMIN_PASSWORD: 'admin-password',
      SMOKE_TEACHER_USERNAME: 'teacher-private', SMOKE_TEACHER_PASSWORD: 'teacher-password',
      SMOKE_STUDENT_USERNAME: 'student-private', SMOKE_STUDENT_PASSWORD: 'student-password',
      SMOKE_PARENT_ACCESS_CODE: 'PARENTCODE', SMOKE_PARENT_PIN: '123456',
    };
    const code = await runProductionSmoke([
      '--site', site, '--apex', apex, '--api', api, '--parent', parent,
      '--mutation-namespace', 'none', '--output', output, '--skip-browser',
    ], { fetchImpl: fakeFetch as typeof fetch, env });

    expect(code).toBe(0);
    const raw = readFileSync(output, 'utf8');
    const report = JSON.parse(raw);
    expect(report.status).toBe('ready');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'role.admin.read', status: 'passed' }),
      expect.objectContaining({ id: 'role.teacher.read', status: 'passed' }),
      expect.objectContaining({ id: 'role.student.read', status: 'passed' }),
      expect.objectContaining({ id: 'role.parent.read', status: 'passed' }),
    ]));
    for (const secret of Object.values(env)) expect(raw).not.toContain(secret);
    for (const [, init] of fakeFetch.mock.calls) expect(init?.redirect).toBe('manual');
  });
});
