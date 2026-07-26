import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const production = process.argv.includes('--production');
const enforce = process.argv.includes('--enforce');
const npmCli = process.env.npm_execpath
  || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

if (!fs.existsSync(npmCli)) {
  process.stderr.write(`npm CLI was not found at ${npmCli}\n`);
  process.exit(2);
}

const args = [npmCli, 'audit', '--json'];
if (production) args.push('--omit=dev');
const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});

let payload;
try {
  payload = JSON.parse(result.stdout || '{}');
} catch {
  process.stderr.write('npm audit did not return valid JSON.\n');
  if (result.stderr) process.stderr.write(`${result.stderr.trim()}\n`);
  process.exit(2);
}

const rawCounts = payload?.metadata?.vulnerabilities || {};
const vulnerabilities = {
  critical: Number(rawCounts.critical || 0),
  high: Number(rawCounts.high || 0),
  moderate: Number(rawCounts.moderate || 0),
  low: Number(rawCounts.low || 0),
  info: Number(rawCounts.info || 0),
  total: Number(rawCounts.total || 0),
};
const summary = {
  generatedAt: new Date().toISOString(),
  scope: production ? 'production' : 'all',
  vulnerabilities,
  dependencies: payload?.metadata?.dependencies || {},
  packages: Object.entries(payload?.vulnerabilities || {}).map(([name, detail]) => ({
    name,
    severity: detail?.severity || 'unknown',
    direct: Boolean(detail?.isDirect),
    fixAvailable: detail?.fixAvailable ?? false,
    via: Array.isArray(detail?.via)
      ? detail.via.map((item) => typeof item === 'string'
        ? item
        : String(item?.title || item?.name || 'advisory'))
      : [],
  })),
};

const reportsDir = path.join(root, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const reportPath = path.join(reportsDir, `dependency-audit-${summary.scope}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(
  `Dependency audit (${summary.scope}): critical=${vulnerabilities.critical} high=${vulnerabilities.high} `
  + `moderate=${vulnerabilities.moderate} low=${vulnerabilities.low} total=${vulnerabilities.total}\n`,
);
process.stdout.write(`Report: ${reportPath}\n`);

if (enforce && vulnerabilities.total > 0) {
  process.stderr.write('Dependency security gate failed because vulnerabilities remain.\n');
  process.exit(1);
}
