import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 15_000;
const PRODUCTION_HOSTS = new Set([
  'thitong.site',
  'www.thitong.site',
  'quiz-api.thitong.site',
  'phieu.thitong.site',
  'thtohieu.com',
  'www.thtohieu.com',
]);
const READ_ONLY_OPTIONS = new Set(['--create-attempt', '--join-live-exam', '--enable-production']);
const SUPPORTED_OPTIONS = new Set([
  '--base-url',
  '--campaign-slug',
  '--student-cookie',
  '--output',
  '--timeout-ms',
  '--allow-local',
]);

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);

const readArg = (args, name) => {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const hasOption = (args, name) => args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));

const required = (value, name) => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
};

export function normalizeCompetitionPortalSmokeUrl(raw, allowLocal = false) {
  if (!String(raw || '').trim()) throw new Error('baseUrl is required.');
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    throw new Error(`Invalid Competition Portal smoke URL: ${raw || '(empty)'}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Competition Portal smoke URLs must not contain credentials, query strings, or fragments.');
  }
  if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Competition Portal smoke refuses production targets; provide a staging URL.');
  }
  if (url.protocol !== 'https:' && !(allowLocal && url.protocol === 'http:' && isLocalHost(url.hostname))) {
    throw new Error('Competition Portal smoke targets must use HTTPS. Use --allow-local only for localhost.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function validateCompetitionPortalSmokeConfig(config) {
  const allowLocal = config.allowLocal === true;
  const baseUrl = normalizeCompetitionPortalSmokeUrl(config.baseUrl, allowLocal);
  const campaignSlug = required(config.campaignSlug, 'campaignSlug');
  const studentCookie = required(config.studentCookie, 'studentCookie');
  if (/\r|\n/.test(studentCookie)) throw new Error('studentCookie must not contain newlines.');
  const timeoutMs = Number(config.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error('timeoutMs must be an integer between 1 and 120000.');
  }
  return { ...config, baseUrl, campaignSlug, studentCookie, timeoutMs, allowLocal };
}

export function parseCompetitionPortalSmokeArgs(
  args = process.argv.slice(2),
  env = process.env,
) {
  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const option = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (READ_ONLY_OPTIONS.has(option)) {
      throw new Error(`Competition Portal smoke is read-only and does not support ${option}.`);
    }
    if (!SUPPORTED_OPTIONS.has(option)) throw new Error(`Unknown Competition Portal smoke option: ${option}`);
  }

  const valueFor = (option, envName) => readArg(args, option) || env[envName];
  const config = {
    baseUrl: valueFor('--base-url', 'COMPETITION_PORTAL_BASE_URL'),
    campaignSlug: valueFor('--campaign-slug', 'COMPETITION_PORTAL_CAMPAIGN_SLUG'),
    studentCookie: valueFor('--student-cookie', 'COMPETITION_PORTAL_STUDENT_COOKIE'),
    outputPath: readArg(args, '--output') || env.COMPETITION_PORTAL_SMOKE_OUTPUT || 'reports/competition-portal-smoke.json',
    timeoutMs: readArg(args, '--timeout-ms') || env.COMPETITION_PORTAL_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    allowLocal: hasOption(args, '--allow-local'),
  };
  return validateCompetitionPortalSmokeConfig(config);
}

const redact = (value) => String(value || '')
  .replace(/(cookie|authorization|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
  .slice(0, 300);

const requestJson = async (fetchImpl, config, path, init = {}) => {
  const { authenticated, headers: initHeaders, ...requestInit } = init;
  const headers = {
    accept: 'application/json',
    ...(init.method && init.method !== 'GET' ? { 'content-type': 'application/json' } : {}),
    ...(authenticated ? { cookie: config.studentCookie } : {}),
  };
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    ...requestInit,
    headers: { ...headers, ...(initHeaders || {}) },
    redirect: 'manual',
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} returned HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`${path} did not return JSON.`);
  return response.json();
};

const writeReport = (outputPath, report) => {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const recordCheck = async (report, id, action) => {
  const started = Date.now();
  try {
    const value = await action();
    const check = { id, status: 'passed', durationMs: Date.now() - started };
    report.checks.push(check);
    process.stdout.write(`[PASS] ${id}\n`);
    return { ok: true, value };
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : 'Smoke check failed');
    report.checks.push({ id, status: 'failed', durationMs: Date.now() - started, message });
    process.stdout.write(`[FAIL] ${id}: ${message}\n`);
    return { ok: false, value: null };
  }
};

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} payload is invalid.`);
  return value;
};

const unwrapPublicPayload = (payload) => {
  if (payload && typeof payload === 'object' && payload.status === 'success' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

export async function runCompetitionPortalSmoke(
  args = process.argv.slice(2),
  { fetchImpl = fetch, env = process.env, now = () => new Date() } = {},
) {
  const config = parseCompetitionPortalSmokeArgs(args, env);
  const report = {
    status: 'running',
    startedAt: now().toISOString(),
    finishedAt: null,
    mode: 'read-only',
    target: config.baseUrl,
    campaignSlug: config.campaignSlug,
    checks: [],
  };

  const publicIndex = await recordCheck(report, 'public.index', async () => {
    const payload = unwrapPublicPayload(await requestJson(fetchImpl, config, '/api/public/competitions'));
    if (!Array.isArray(payload)) throw new Error('Public competition index must be an array.');
    const campaign = payload.find((item) => item?.slug === config.campaignSlug);
    if (!campaign) throw new Error(`Campaign ${config.campaignSlug} was not found in the public index.`);
    return campaign;
  });
  const summary = publicIndex.value;

  const publicDetail = await recordCheck(report, 'public.detail', async () => {
    if (!summary) throw new Error('Public index check did not produce a campaign.');
    const payload = assertObject(
      unwrapPublicPayload(await requestJson(fetchImpl, config, `/api/public/competitions/${encodeURIComponent(config.campaignSlug)}`)),
      'Public detail',
    );
    if (payload.slug !== config.campaignSlug) throw new Error('Public detail returned a different campaign slug.');
    if (!Array.isArray(payload.rounds) || payload.rounds.length !== 6) {
      throw new Error('Public detail must expose exactly six rounds.');
    }
    return payload;
  });
  const detail = publicDetail.value;

  await recordCheck(report, 'public.article', async () => {
    if (!detail) throw new Error('Public detail check did not produce a campaign.');
    const article = Array.isArray(detail.articles) ? detail.articles[0] : null;
    if (!article?.slug) throw new Error('Published public campaign has no article fixture.');
    const payload = assertObject(
      unwrapPublicPayload(await requestJson(
        fetchImpl,
        config,
        `/api/public/competitions/${encodeURIComponent(config.campaignSlug)}/articles/${encodeURIComponent(article.slug)}`,
      )),
      'Public article',
    );
    if (payload.slug !== article.slug) throw new Error('Public article returned a different article slug.');
    return payload;
  });

  await recordCheck(report, 'public.golden_board.publication', async () => {
    if (!detail?.goldenBoardAvailable) throw new Error('Golden Board is not marked as published for the smoke fixture.');
    const payload = assertObject(
      unwrapPublicPayload(await requestJson(fetchImpl, config, `/api/public/competitions/${encodeURIComponent(config.campaignSlug)}/golden-board`)),
      'Golden Board',
    );
    if (!Array.isArray(payload.winners)) throw new Error('Golden Board winners payload is invalid.');
    for (const field of ['publicationVersion', 'rankingVersion', 'awardRuleVersion']) {
      if (!Number.isInteger(payload[field]) || payload[field] < 1) throw new Error(`Golden Board ${field} is invalid.`);
    }
    return payload;
  });

  const studentResolution = await recordCheck(report, 'student.portal.resolve', async () => {
    const payload = assertObject(
      await requestJson(
        fetchImpl,
        config,
        `/api/student/competitions/by-slug/${encodeURIComponent(config.campaignSlug)}`,
        { authenticated: true },
      ),
      'Student portal resolution',
    );
    if (payload.portal?.slug !== config.campaignSlug || !payload.portal?.campaignId) {
      throw new Error('Student portal resolution is not bound to the requested campaign.');
    }
    if (!Array.isArray(payload.portal.rounds) || payload.portal.rounds.length !== 6) {
      throw new Error('Student portal must expose exactly six rounds.');
    }
    return payload;
  });
  const portal = studentResolution.value?.portal;

  await recordCheck(report, 'student.round.preflight', async () => {
    if (!portal) throw new Error('Student portal resolution did not produce a portal.');
    const round = portal.rounds.find((item) => item?.roundId);
    if (!round) throw new Error('Student portal has no round preflight fixture.');
    const payload = assertObject(
      await requestJson(
        fetchImpl,
        config,
        `/api/student/competitions/${encodeURIComponent(portal.campaignId)}/rounds/${encodeURIComponent(round.roundId)}/preflight`,
        { method: 'POST', body: '{}', authenticated: true },
      ),
      'Student round preflight',
    );
    if (payload.preflight?.campaignId !== portal.campaignId || payload.preflight?.roundId !== round.roundId) {
      throw new Error('Student round preflight returned a mismatched campaign or round.');
    }
    if (payload.preflight.status !== 'READY') throw new Error(`Student round preflight is ${payload.preflight.status}.`);
    return payload;
  });

  await recordCheck(report, 'student.school_exam.preflight', async () => {
    if (!portal?.schoolExam?.qualified || !portal.schoolExam.ready) {
      throw new Error('Student portal does not contain a ready School Exam fixture.');
    }
    const payload = assertObject(
      await requestJson(
        fetchImpl,
        config,
        `/api/student/competitions/${encodeURIComponent(portal.campaignId)}/school-exam/preflight`,
        { method: 'POST', body: '{}', authenticated: true },
      ),
      'School Exam preflight',
    );
    if (payload.preflight?.campaignId !== portal.campaignId || payload.preflight.status !== 'READY') {
      throw new Error('School Exam preflight is not READY for the fixture.');
    }
    if (!String(payload.preflight.accessCode || '').trim()) throw new Error('School Exam preflight did not return an access code.');
    return payload;
  });

  report.status = report.checks.some((check) => check.status === 'failed') ? 'blocked' : 'ready';
  report.finishedAt = now().toISOString();
  writeReport(config.outputPath, report);
  process.stdout.write(`${JSON.stringify({ status: report.status, checks: report.checks.length, output: config.outputPath })}\n`);
  return report;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();

if (isEntryPoint) {
  const args = process.argv.slice(2);
  let outputPath = readArg(args, '--output') || process.env.COMPETITION_PORTAL_SMOKE_OUTPUT || 'reports/competition-portal-smoke.json';
  try {
    const report = await runCompetitionPortalSmoke(args);
    process.exitCode = report.status === 'ready' ? 0 : 1;
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : 'Competition Portal smoke failed');
    const report = {
      status: 'blocked',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      mode: 'read-only',
      checks: [{ id: 'configuration', status: 'failed', durationMs: 0, message }],
    };
    try {
      writeReport(outputPath, report);
    } catch {
      outputPath = '';
    }
    process.stderr.write(`${message}${outputPath ? ` Report: ${outputPath}` : ''}\n`);
    process.exitCode = 1;
  }
}
