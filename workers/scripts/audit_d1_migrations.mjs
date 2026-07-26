import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workersDir = path.resolve(scriptDir, '..');
const configPath = path.join(workersDir, 'wrangler.toml');
const auditSqlPath = path.join(scriptDir, 'audit_d1_migration_state.sql');
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.error('CLOUDFLARE_API_TOKEN is required.');
  process.exit(2);
}

const [configText, sql] = await Promise.all([
  fs.readFile(configPath, 'utf8'),
  fs.readFile(auditSqlPath, 'utf8'),
]);

const accountId = configText.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1];
const databaseId = configText.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
if (!accountId || !databaseId) {
  console.error('Could not resolve account_id/database_id from wrangler.toml.');
  process.exit(2);
}

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  },
);
const payload = await response.json();
if (!response.ok || payload.success === false) {
  console.error(JSON.stringify({ status: response.status, errors: payload.errors }, null, 2));
  process.exit(1);
}

const rows = payload.result?.[0]?.results ?? [];
for (const row of rows) {
  const marker = Number(row.ok) === 1 ? 'PASS' : 'FAIL';
  const detail = row.failed_checks ? ` | ${row.failed_checks}` : '';
  console.log(`${marker} | ${row.migration} | checks=${row.checks_run}${detail}`);
}

const failures = rows.filter((row) => Number(row.ok) !== 1);
console.log(`SUMMARY | migrations=${rows.length} failed=${failures.length}`);
process.exit(failures.length === 0 && rows.length > 0 ? 0 : 1);
