import { readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runProductionSmoke } from '../scripts/run-production-smoke.mjs';

const output = 'reports/production-smoke-test.json';
const site = 'https://www.thtohieu.com';
const apex = 'https://thtohieu.com';
const api = 'https://api.thtohieu.com';
const parent = 'https://phuhuynh.thtohieu.com';
const html = '<!doctype html><title>TôHiệuQuiz</title><div id="root"></div>';
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
  });
});
