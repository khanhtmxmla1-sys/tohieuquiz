import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AUDIT_COUNT_FIELDS = ['critical', 'high', 'moderate', 'low', 'info', 'total'];
const SEVERITY_FIELDS = ['critical', 'high', 'moderate', 'low', 'info'];
const SAFE_ERROR_CODES = new Set(['EAUDIT', 'EAUDITNOLOCK', 'EAUDITNOPJSON', 'ENOENT']);

function sanitizedCode(value) {
  return typeof value === 'string' && SAFE_ERROR_CODES.has(value)
    ? value
    : '';
}

function writeMessage(write, message) {
  try {
    write(message);
    return true;
  } catch {
    // Reporting an error must not turn a controlled audit failure into an uncaught exception.
    return false;
  }
}

/**
 * Parse and validate npm audit output before any report is written.
 * npm audit uses status 1 for a valid report containing findings, so status 1
 * is accepted when the payload is internally consistent.
 */
export function parseNpmAuditResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid npm audit process result.');
  }

  if (result.error) {
    const code = sanitizedCode(result.error.code);
    throw new Error(`npm audit process failed${code ? ` (${code})` : ''}.`);
  }

  if (result.signal) {
    throw new Error('npm audit process terminated unexpectedly by signal.');
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error('npm audit process exited unexpectedly.');
  }

  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (!stdout) {
    throw new Error('npm audit did not return valid JSON: stdout was empty.');
  }

  let audit;
  try {
    audit = JSON.parse(stdout);
  } catch {
    throw new Error('npm audit did not return valid JSON.');
  }

  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    throw new Error('Invalid npm audit result: expected a JSON object.');
  }

  if (audit.error) {
    const code = sanitizedCode(audit.error.code);
    throw new Error(`Invalid npm audit result${code ? ` (${code})` : ''}: npm audit returned an error payload.`);
  }

  const counts = audit.metadata?.vulnerabilities;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
    throw new Error('Invalid npm audit result: metadata.vulnerabilities is missing.');
  }

  for (const field of AUDIT_COUNT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(counts, field)) {
      throw new Error(`Invalid npm audit result: vulnerability count ${field} is missing.`);
    }
    if (!Number.isSafeInteger(counts[field]) || counts[field] < 0) {
      throw new Error(`Invalid npm audit result: vulnerability count ${field} is invalid.`);
    }
  }

  const vulnerabilities = audit.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    throw new Error('Invalid npm audit result: vulnerabilities map is missing.');
  }

  const vulnerabilityEntries = Object.entries(vulnerabilities);
  if (vulnerabilityEntries.length !== counts.total) {
    throw new Error('Invalid npm audit result: vulnerability map does not match total.');
  }

  const severityCounts = Object.fromEntries(SEVERITY_FIELDS.map(field => [field, 0]));
  for (const [, detail] of vulnerabilityEntries) {
    const severity = detail && typeof detail === 'object' ? detail.severity : undefined;
    if (!SEVERITY_FIELDS.includes(severity)) {
      throw new Error('Invalid npm audit result: vulnerability severity is invalid.');
    }
    severityCounts[severity] += 1;
  }

  for (const field of SEVERITY_FIELDS) {
    if (counts[field] !== severityCounts[field]) {
      throw new Error('Invalid npm audit result: vulnerability severity counts do not match the map.');
    }
  }

  if (result.status === 1 && counts.total === 0) {
    throw new Error('Invalid npm audit result: status 1 cannot have zero vulnerabilities.');
  }

  return audit;
}

export function buildDependencyAuditSummary(
  payload,
  { workspace = 'root', production = false, generatedAt = new Date().toISOString() } = {},
) {
  const rawCounts = payload.metadata.vulnerabilities;
  const vulnerabilities = Object.fromEntries(
    AUDIT_COUNT_FIELDS.map(field => [field, rawCounts[field]]),
  );

  return {
    generatedAt,
    workspace,
    scope: production ? 'production' : 'all',
    vulnerabilities,
    dependencies: payload.metadata.dependencies || {},
    packages: Object.entries(payload.vulnerabilities).map(([name, detail]) => ({
      name,
      severity: detail?.severity || 'unknown',
      direct: Boolean(detail?.isDirect),
      fixAvailable: detail?.fixAvailable ?? false,
      via: Array.isArray(detail?.via)
        ? detail.via.map(item => typeof item === 'string'
          ? item
          : String(item?.title || item?.name || 'advisory'))
        : [],
    })),
  };
}

export function runDependencyAudit({
  projectRoot = process.cwd(),
  workspace = 'root',
  production = false,
  enforce = false,
  npmCliPath = process.env.npm_execpath
    || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  spawnSyncImpl = spawnSync,
  writeError = message => process.stderr.write(message),
  writeOutput = message => process.stdout.write(message),
  generatedAt = new Date().toISOString(),
} = {}) {
  const auditRoot = workspace === 'root' ? projectRoot : path.resolve(projectRoot, workspace);

  try {
    if (!fs.existsSync(npmCliPath)) {
      writeMessage(writeError, 'npm CLI was not found.\n');
      return 2;
    }
  } catch {
    writeMessage(writeError, 'npm CLI could not be located.\n');
    return 2;
  }

  const args = [npmCliPath, 'audit', '--json'];
  if (production) args.push('--omit=dev');

  let result;
  try {
    result = spawnSyncImpl(process.execPath, args, {
      cwd: auditRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
  } catch {
    writeMessage(writeError, 'npm audit process could not be started.\n');
    return 2;
  }

  let payload;
  try {
    payload = parseNpmAuditResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid npm audit result.';
    writeMessage(writeError, `${message}\n`);
    return 2;
  }

  const summary = buildDependencyAuditSummary(payload, { workspace, production, generatedAt });
  const reportsDir = path.join(projectRoot, 'reports');
  const reportPath = path.join(reportsDir, `dependency-audit-${workspace}-${summary.scope}.json`);

  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
  } catch {
    writeMessage(writeError, 'Dependency audit report could not be written.\n');
    return 2;
  }

  const { vulnerabilities } = summary;
  const summaryWritten = writeMessage(
    writeOutput,
    `Dependency audit (${workspace}/${summary.scope}): critical=${vulnerabilities.critical} high=${vulnerabilities.high} `
      + `moderate=${vulnerabilities.moderate} low=${vulnerabilities.low} total=${vulnerabilities.total}\n`,
  );
  const reportPathWritten = writeMessage(writeOutput, `Report: ${reportPath}\n`);
  if (!summaryWritten || !reportPathWritten) {
    return 2;
  }

  if (enforce && vulnerabilities.total > 0) {
    return writeMessage(writeError, 'Dependency security gate failed because vulnerabilities remain.\n') ? 1 : 2;
  }

  return 0;
}

const currentModule = fileURLToPath(import.meta.url);
const invokedScript = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedScript === path.resolve(currentModule)) {
  const workspaceArg = process.argv.find(argument => argument.startsWith('--workspace='));
  const workspace = workspaceArg ? workspaceArg.slice('--workspace='.length) : 'root';
  process.exitCode = runDependencyAudit({
    workspace,
    production: process.argv.includes('--production'),
    enforce: process.argv.includes('--enforce'),
  });
}
