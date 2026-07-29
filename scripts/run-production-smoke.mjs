import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DEFAULT_TIMEOUT_MS = 15_000;
const HOSTILE_ORIGIN = 'https://hostile.invalid';
const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);

export function normalizeSmokeUrl(raw, allowLocal = false) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    throw new Error(`Invalid smoke URL: ${raw || '(empty)'}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Smoke URLs must not contain credentials, query strings, or fragments.');
  }
  if (url.protocol !== 'https:' && !(allowLocal && url.protocol === 'http:' && isLocalHost(url.hostname))) {
    throw new Error('Production smoke targets must use HTTPS. Use --allow-local only for localhost.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function assertMutationNamespace(namespace) {
  const normalized = String(namespace || 'none').trim().toLowerCase();
  if (!['none', 'staging', 'test'].includes(normalized)) {
    throw new Error('Mutation namespace must be none, staging, or test.');
  }
  return normalized;
}

export function redactSmokeText(value) {
  return String(value || '')
    .replace(/bearer\s+[a-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization|cookie|password|pin|access[_ -]?code|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 300);
}

const readArg = (args, name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const requiredEnv = (env, names) => {
  const values = Object.fromEntries(names.map((name) => [name, String(env[name] || '')]));
  const missing = names.filter((name) => !values[name]);
  if (missing.length > 0) throw new Error(`Missing protected smoke credentials: ${missing.join(', ')}`);
  return values;
};

const getCookieHeader = (headers) => {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  const cookies = values.map((value) => String(value).split(';', 1)[0]).filter(Boolean);
  if (cookies.length === 0) throw new Error('Authentication response did not issue a session cookie.');
  return cookies.join('; ');
};

const request = async (fetchImpl, url, init = {}) => fetchImpl(url, {
  ...init,
  redirect: 'manual',
  signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
});

const expectStatus = (response, expected, label) => {
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status)) {
    throw new Error(`${label} returned HTTP ${response.status}; expected ${statuses.join(' or ')}.`);
  }
};

const expectHtmlShell = async (response, label) => {
  expectStatus(response, 200, label);
  const body = await response.text();
  if (!body.includes('<title>TôHiệuQuiz') || !body.includes('id="root"')) {
    throw new Error(`${label} did not return the TôHiệuQuiz application shell.`);
  }
};

const expectSecurityHeaders = (response, label) => {
  if (!response.headers.get('strict-transport-security')) throw new Error(`${label} is missing HSTS.`);
  if (response.headers.get('x-content-type-options') !== 'nosniff') throw new Error(`${label} is missing nosniff.`);
  if (!String(response.headers.get('content-security-policy') || '').includes("default-src 'self'")) {
    throw new Error(`${label} is missing the expected CSP.`);
  }
};

const login = async (fetchImpl, apiUrl, origin, path, body) => {
  const response = await request(fetchImpl, `${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
  expectStatus(response, 200, path);
  const payload = await response.clone().json().catch(() => ({}));
  if (payload?.data?.requiresPasswordChange) {
    throw new Error('Smoke account requires a password change and cannot be used for automated production checks.');
  }
  return getCookieHeader(response.headers);
};

const authenticatedRead = async (fetchImpl, apiUrl, origin, cookie, path, label) => {
  const response = await request(fetchImpl, `${apiUrl}${path}`, {
    headers: { cookie, origin },
  });
  expectStatus(response, 200, label);
  return response;
};

const addCheck = async (report, id, action) => {
  const started = Date.now();
  try {
    await action();
    report.checks.push({ id, status: 'passed', durationMs: Date.now() - started });
  } catch (error) {
    report.checks.push({
      id,
      status: 'failed',
      durationMs: Date.now() - started,
      message: redactSmokeText(error instanceof Error ? error.message : 'Smoke check failed'),
    });
  }
};

const writeReport = (outputPath, report) => {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

export async function runProductionSmoke(
  args = process.argv.slice(2),
  { fetchImpl = fetch, spawn = spawnSync, env = process.env } = {},
) {
  const allowLocal = args.includes('--allow-local');
  const skipBrowser = args.includes('--skip-browser');
  const aiSmoke = args.includes('--ai-smoke');
  const siteUrl = normalizeSmokeUrl(readArg(args, '--site'), allowLocal);
  const apexUrl = normalizeSmokeUrl(readArg(args, '--apex') || siteUrl, allowLocal);
  const apiUrl = normalizeSmokeUrl(readArg(args, '--api'), allowLocal);
  const parentUrl = normalizeSmokeUrl(readArg(args, '--parent'), allowLocal);
  const outputPath = readArg(args, '--output') || 'reports/production-smoke.json';
  const mutationNamespace = assertMutationNamespace(readArg(args, '--mutation-namespace') || 'none');
  const report = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    targets: { site: siteUrl, apex: apexUrl, api: apiUrl, parent: parentUrl },
    aiSmoke,
    mutationNamespace,
    checks: [],
  };

  await addCheck(report, 'frontend.site', async () => {
    const response = await request(fetchImpl, `${siteUrl}/`);
    await expectHtmlShell(response.clone(), 'Site frontend');
    expectSecurityHeaders(response, 'Site frontend');
  });
  await addCheck(report, 'frontend.apex', async () => {
    const response = await request(fetchImpl, `${apexUrl}/`);
    expectStatus(response, [200, 301, 302, 307, 308], 'Apex frontend');
  });
  await addCheck(report, 'frontend.parent', async () => {
    const response = await request(fetchImpl, `${parentUrl}/login`);
    await expectHtmlShell(response.clone(), 'Parent frontend');
    expectSecurityHeaders(response, 'Parent frontend');
  });
  await addCheck(report, 'api.same_origin_health', async () => {
    const response = await request(fetchImpl, `${siteUrl}/api/health`);
    expectStatus(response, 200, 'Same-origin health');
    const payload = await response.json();
    if (payload?.status !== 'ok') throw new Error('Same-origin health payload is not ok.');
  });
  await addCheck(report, 'api.direct_health_cors', async () => {
    const response = await request(fetchImpl, `${apiUrl}/api/health`, { headers: { origin: siteUrl } });
    expectStatus(response, 200, 'Direct API health');
    if (response.headers.get('access-control-allow-origin') !== siteUrl) {
      throw new Error('Direct API did not return the exact approved CORS origin.');
    }
  });
  await addCheck(report, 'api.hostile_origin', async () => {
    const response = await request(fetchImpl, `${apiUrl}/api/health`, { headers: { origin: HOSTILE_ORIGIN } });
    if (response.headers.get('access-control-allow-origin') === HOSTILE_ORIGIN) {
      throw new Error('Hostile origin was reflected by CORS.');
    }
  });

  for (const [id, path] of [
    ['guard.admin', '/api/admin/operations'],
    ['guard.teacher', '/api/teacher/action-center'],
    ['guard.student', '/api/student-profile'],
    ['guard.parent', '/api/parent/dashboard'],
  ]) {
    await addCheck(report, id, async () => {
      const response = await request(fetchImpl, `${apiUrl}${path}`, { headers: { origin: siteUrl } });
      expectStatus(response, [401, 403], id);
    });
  }

  let teacherCookie = '';
  await addCheck(report, 'role.admin.read', async () => {
    const credentials = requiredEnv(env, ['SMOKE_ADMIN_USERNAME', 'SMOKE_ADMIN_PASSWORD']);
    const cookie = await login(fetchImpl, apiUrl, siteUrl, '/api/login', {
      username: credentials.SMOKE_ADMIN_USERNAME,
      password: credentials.SMOKE_ADMIN_PASSWORD,
    });
    const response = await authenticatedRead(fetchImpl, apiUrl, siteUrl, cookie, '/api/admin/operations', 'Admin operations');
    if (!String(response.headers.get('cache-control') || '').includes('no-store')) {
      throw new Error('Admin operations response must be no-store.');
    }
  });
  await addCheck(report, 'role.teacher.read', async () => {
    const credentials = requiredEnv(env, ['SMOKE_TEACHER_USERNAME', 'SMOKE_TEACHER_PASSWORD']);
    teacherCookie = await login(fetchImpl, apiUrl, siteUrl, '/api/login', {
      username: credentials.SMOKE_TEACHER_USERNAME,
      password: credentials.SMOKE_TEACHER_PASSWORD,
    });
    await authenticatedRead(fetchImpl, apiUrl, siteUrl, teacherCookie, '/api/teacher/action-center', 'Teacher action center');
  });
  await addCheck(report, 'role.student.read', async () => {
    const credentials = requiredEnv(env, ['SMOKE_STUDENT_USERNAME', 'SMOKE_STUDENT_PASSWORD']);
    const cookie = await login(fetchImpl, apiUrl, siteUrl, '/api/student-login', {
      username: credentials.SMOKE_STUDENT_USERNAME,
      password: credentials.SMOKE_STUDENT_PASSWORD,
    });
    await authenticatedRead(fetchImpl, apiUrl, siteUrl, cookie, '/api/student-profile', 'Student profile');
  });
  await addCheck(report, 'role.parent.read', async () => {
    const credentials = requiredEnv(env, ['SMOKE_PARENT_ACCESS_CODE', 'SMOKE_PARENT_PIN']);
    const cookie = await login(fetchImpl, apiUrl, parentUrl, '/api/parent/login', {
      accessCode: credentials.SMOKE_PARENT_ACCESS_CODE,
      pin: credentials.SMOKE_PARENT_PIN,
    });
    await authenticatedRead(fetchImpl, apiUrl, parentUrl, cookie, '/api/parent/dashboard', 'Parent dashboard');
  });

  if (aiSmoke) {
    await addCheck(report, 'ai.rollout_readiness', async () => {
      if (!teacherCookie) throw new Error('Teacher session unavailable for AI smoke.');
      await authenticatedRead(fetchImpl, apiUrl, siteUrl, teacherCookie, '/api/teacher-ai-quota', 'Teacher AI quota');
      await authenticatedRead(
        fetchImpl,
        apiUrl,
        siteUrl,
        teacherCookie,
        '/api/system-settings/feature-flags/resolve?flag=ai_assistant_enabled',
        'AI rollout resolution',
      );
    });
  }

  if (!skipBrowser) {
    await addCheck(report, 'browser.public_shell', async () => {
      const cypressCli = resolve(dirname(require.resolve('cypress')), '..', 'bin', 'cypress');
      const result = spawn(process.execPath, [
        cypressCli,
        'run',
        '--e2e',
        '--spec',
        'cypress/e2e/production-smoke.cy.ts',
        '--config',
        `baseUrl=${siteUrl}`,
        '--env',
        `apexBaseUrl=${apexUrl},apiBaseUrl=${apiUrl},parentBaseUrl=${parentUrl}`,
      ], { stdio: 'inherit', env });
      if (result.error) throw result.error;
      if ((result.status ?? 1) !== 0) throw new Error(`Public browser smoke exited with code ${result.status ?? 1}.`);
    });
  }

  report.status = report.checks.some((check) => check.status === 'failed') ? 'blocked' : 'ready';
  report.finishedAt = new Date().toISOString();
  writeReport(outputPath, report);
  process.stdout.write(`${JSON.stringify({ status: report.status, checks: report.checks.length, output: outputPath })}\n`);
  return report.status === 'ready' ? 0 : 1;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntryPoint) {
  const args = process.argv.slice(2);
  runProductionSmoke(args).then((code) => { process.exitCode = code; }).catch((error) => {
    const outputPath = readArg(args, '--output') || 'reports/production-smoke.json';
    const message = redactSmokeText(error instanceof Error ? error.message : 'Production smoke failed');
    writeReport(outputPath, {
      status: 'blocked',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      checks: [{ id: 'configuration', status: 'failed', durationMs: 0, message }],
    });
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
