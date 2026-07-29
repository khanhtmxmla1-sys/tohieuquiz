import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSmokeUrl, redactSmokeText } from './run-production-smoke.mjs';

export const ROLLOUT_STAGES = ['admin-only', 'teachers-5', 'pilot-class', 'teachers-25', 'full'];
const OBSERVATION_HOURS = {
  'admin-only': 24,
  'teachers-5': 24,
  'pilot-class': 48,
  'teachers-25': 24,
  full: 48,
};
const PREVIOUS_STAGE = {
  'admin-only': null,
  'teachers-5': 'admin-only',
  'pilot-class': 'teachers-5',
  'teachers-25': 'pilot-class',
  full: 'teachers-25',
};
const PATCH_ORDER = ['enabled', 'audience', 'percentage', 'allowUsers', 'allowClasses'];
const TIMEOUT_MS = 15_000;

const readArg = (args, name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const required = (value, name) => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
};

export function buildStageTarget(stage, pilotClassId = '') {
  if (!ROLLOUT_STAGES.includes(stage)) throw new Error(`Unknown rollout stage: ${stage}`);
  const common = { enabled: true, allowUsers: [], allowClasses: [] };
  if (stage === 'admin-only') return { ...common, audience: 'admin', percentage: 100 };
  if (stage === 'teachers-5') return { ...common, audience: 'teacher', percentage: 5 };
  if (stage === 'pilot-class') {
    return { ...common, audience: 'teacher', percentage: 0, allowClasses: [required(pilotClassId, 'pilotClassId')] };
  }
  if (stage === 'teachers-25') return { ...common, audience: 'teacher', percentage: 25 };
  return { ...common, audience: 'all', percentage: 100 };
}

export function evaluateRolloutMetrics({ stage, observationStartedAt, metrics, now = new Date() }) {
  if (!ROLLOUT_STAGES.includes(stage)) throw new Error(`Unknown rollout stage: ${stage}`);
  const started = new Date(required(observationStartedAt, 'observationStartedAt'));
  if (Number.isNaN(started.getTime())) throw new Error('observationStartedAt must be an ISO timestamp.');
  const elapsedHours = Math.max(0, (now.getTime() - started.getTime()) / 3_600_000);
  const breaches = [];
  const rate5xx = Number(metrics.error5xxRatePercent || 0);
  const client = Number(metrics.clientErrorRate || 0);
  const baselineClient = Number(metrics.baselineClientErrorRate || 0);
  const p95 = Number(metrics.p95Ms || 0);
  const baselineP95 = Number(metrics.baselineP95Ms || 0);
  if (rate5xx > 1) breaches.push('5xx_rate');
  if (baselineClient > 0 && client > baselineClient * 2) breaches.push('client_errors');
  if (baselineP95 > 0 && p95 > baselineP95 * 1.3) breaches.push('p95_latency');
  if (metrics.dataCorruption === true) breaches.push('data_corruption');
  if (metrics.authAnomaly === true) breaches.push('auth_anomaly');
  const requiredHours = OBSERVATION_HOURS[stage];
  return {
    status: breaches.length > 0 ? 'blocked' : elapsedHours < requiredHours ? 'observing' : 'ready',
    stage,
    elapsedHours: Number(elapsedHours.toFixed(2)),
    requiredHours,
    breaches,
  };
}

export function summarizeTarget(target) {
  return {
    enabled: target.enabled,
    audience: target.audience,
    percentage: target.percentage,
    allowUsersCount: Array.isArray(target.allowUsers) ? target.allowUsers.length : 0,
    allowClassesCount: Array.isArray(target.allowClasses) ? target.allowClasses.length : 0,
  };
}

const getCookies = (headers) => {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  const cookies = values.map((value) => String(value).split(';', 1)[0]).filter(Boolean);
  if (cookies.length === 0) throw new Error('Admin login did not issue a session cookie.');
  return cookies.join('; ');
};

const http = async (url, init = {}) => fetch(url, {
  ...init,
  redirect: 'manual',
  signal: AbortSignal.timeout(TIMEOUT_MS),
});

const loginAdmin = async (apiUrl, siteUrl, env) => {
  const username = required(env.SMOKE_ADMIN_USERNAME, 'SMOKE_ADMIN_USERNAME');
  const password = required(env.SMOKE_ADMIN_PASSWORD, 'SMOKE_ADMIN_PASSWORD');
  const response = await http(`${apiUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: siteUrl },
    body: JSON.stringify({ username, password }),
  });
  if (response.status !== 200) throw new Error(`Admin login returned HTTP ${response.status}.`);
  const payload = await response.clone().json().catch(() => ({}));
  if (payload?.data?.requiresPasswordChange) throw new Error('Admin smoke account requires a password change.');
  return getCookies(response.headers);
};

const apiJson = async (apiUrl, siteUrl, cookie, path, init = {}) => {
  const response = await http(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      origin: siteUrl,
      cookie,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Feature rollout API returned HTTP ${response.status}.`);
  }
  return payload?.data;
};

const loadFlag = async (apiUrl, siteUrl, cookie, key) => {
  const flags = await apiJson(apiUrl, siteUrl, cookie, '/api/system-settings/feature-flags');
  const flag = Array.isArray(flags) ? flags.find((item) => item.key === key) : null;
  if (!flag) throw new Error(`Feature flag not found: ${key}`);
  return flag;
};

const patchField = async (apiUrl, siteUrl, cookie, key, field, value, reason) => apiJson(
  apiUrl,
  siteUrl,
  cookie,
  `/api/system-settings/feature-flags/${encodeURIComponent(key)}`,
  { method: 'PATCH', body: JSON.stringify({ field, value, reason }) },
);

const equalValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const applyTarget = async ({ apiUrl, siteUrl, cookie, key, target, reason }) => {
  const before = await loadFlag(apiUrl, siteUrl, cookie, key);
  const changed = [];
  try {
    for (const field of PATCH_ORDER) {
      if (equalValue(before[field], target[field])) continue;
      await patchField(apiUrl, siteUrl, cookie, key, field, target[field], reason);
      changed.push(field);
    }
  } catch (error) {
    const compensationFailures = [];
    for (const field of [...changed].reverse()) {
      try {
        await patchField(apiUrl, siteUrl, cookie, key, field, before[field], `Compensate failed rollout: ${reason}`);
      } catch {
        compensationFailures.push(field);
      }
    }
    if (compensationFailures.length > 0) {
      throw new Error(
        `Rollout failed and compensation was incomplete for fields: ${compensationFailures.join(', ')}.`,
        { cause: error },
      );
    }
    throw error;
  }
  const after = await loadFlag(apiUrl, siteUrl, cookie, key);
  return { before, after, changed };
};

const writeReport = (path, report) => {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

export async function runStagedRollout(args = process.argv.slice(2), env = process.env) {
  const action = readArg(args, '--action') || 'plan';
  const stage = required(readArg(args, '--stage'), 'stage');
  const key = required(readArg(args, '--flag'), 'flag');
  const pilotClassId = readArg(args, '--pilot-class') || '';
  const output = readArg(args, '--output') || 'reports/staged-rollout.json';
  const reason = readArg(args, '--reason') || `Automated staged rollout: ${stage}`;
  const report = {
    status: 'running',
    action,
    flagKey: key,
    stage,
    generatedAt: new Date().toISOString(),
  };

  try {
    const apiUrl = normalizeSmokeUrl(readArg(args, '--api'), false);
    const siteUrl = normalizeSmokeUrl(readArg(args, '--site'), false);
    report.target = summarizeTarget(buildStageTarget(stage, pilotClassId));
    if (action === 'plan') {
      report.status = 'planned';
      report.observationHours = OBSERVATION_HOURS[stage];
    } else if (action === 'evaluate') {
      const metricsPath = required(readArg(args, '--metrics'), 'metrics');
      const metrics = JSON.parse(readFileSync(metricsPath, 'utf8').replace(/^\uFEFF/, ''));
      Object.assign(report, evaluateRolloutMetrics({
        stage,
        observationStartedAt: readArg(args, '--observation-started-at'),
        metrics,
      }));
      if (report.status === 'blocked' && args.includes('--auto-rollback')) {
        const previous = PREVIOUS_STAGE[stage];
        if (!previous) throw new Error('The first rollout stage has no previous stage to roll back to.');
        const cookie = await loginAdmin(apiUrl, siteUrl, env);
        const result = await applyTarget({
          apiUrl,
          siteUrl,
          cookie,
          key,
          target: buildStageTarget(previous, pilotClassId),
          reason: `Automatic rollback after stop condition: ${report.breaches.join(', ')}`,
        });
        report.rollback = { stage: previous, changedFields: result.changed };
      }
    } else if (action === 'apply' || action === 'rollback') {
      const selectedStage = action === 'rollback' ? PREVIOUS_STAGE[stage] : stage;
      if (!selectedStage) throw new Error('The first rollout stage has no previous stage.');
      const cookie = await loginAdmin(apiUrl, siteUrl, env);
      const result = await applyTarget({
        apiUrl,
        siteUrl,
        cookie,
        key,
        target: buildStageTarget(selectedStage, pilotClassId),
        reason,
      });
      report.status = 'applied';
      report.appliedStage = selectedStage;
      report.changedFields = result.changed;
      report.before = summarizeTarget(result.before);
      report.after = summarizeTarget(result.after);
    } else {
      throw new Error(`Unsupported rollout action: ${action}`);
    }
  } catch (error) {
    report.status = 'blocked';
    report.message = redactSmokeText(error instanceof Error ? error.message : 'Staged rollout failed');
  }

  writeReport(output, report);
  process.stdout.write(`${JSON.stringify({ status: report.status, action, stage, output })}\n`);
  return ['planned', 'observing', 'ready', 'applied'].includes(report.status) ? 0 : 1;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntryPoint) {
  const args = process.argv.slice(2);
  runStagedRollout(args).then((code) => { process.exitCode = code; }).catch((error) => {
    const output = readArg(args, '--output') || 'reports/staged-rollout.json';
    const message = redactSmokeText(error instanceof Error ? error.message : 'Staged rollout failed');
    writeReport(output, {
      status: 'blocked',
      action: readArg(args, '--action') || 'unknown',
      stage: readArg(args, '--stage') || 'unknown',
      generatedAt: new Date().toISOString(),
      message,
    });
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
