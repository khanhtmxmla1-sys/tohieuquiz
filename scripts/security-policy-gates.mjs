import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const failures = [];
const requireText = (source, needle, message) => {
  if (!source.includes(needle)) failures.push(message);
};

const headers = readFileSync('public/_headers', 'utf8');
for (const directive of [
  'Content-Security-Policy:',
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
]) requireText(headers, directive, `Missing browser security header/directive: ${directive}`);

const cors = [
  readFileSync('workers/src/middleware/cors.ts', 'utf8'),
  readFileSync('workers/src/middleware/originGuard.ts', 'utf8'),
].join('\n');
requireText(cors, 'ALLOWED_ORIGINS', 'Worker CORS/origin policy must use ALLOWED_ORIGINS.');
requireText(cors, 'Access-Control-Allow-Origin', 'Worker CORS headers are missing.');
if (/Access-Control-Allow-Origin[^\n]*['"]\*['"]/.test(cors)) failures.push('Wildcard CORS origin is forbidden.');

const securityScan = readFileSync('scripts/security-scan.mjs', 'utf8');
requireText(securityScan, 'browser-jwt-storage', 'Browser JWT storage detection is missing from security scan.');
requireText(securityScan, 'browser-bearer-session', 'Browser bearer-session detection is missing from security scan.');

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
for (const file of walk('src')) {
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(file)) || /(?:test|spec|fixture)/i.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (file.replaceAll('\\', '/') !== 'src/services/api/auth.ts' && /Authorization\s*[:=][^\n]{0,80}Bearer/.test(source)) {
    failures.push(`Browser bearer session found in ${file}`);
  }
  if (/localStorage\.setItem\([^\n]*(?:auth-storage|auth_session|jwt_token)/i.test(source)) {
    failures.push(`Browser auth persistence found in ${file}`);
  }
}

const migrations = readdirSync('workers/migrations').filter((name) => /^00(?:42|43|44)_.*\.sql$/.test(name));
const rollbackPrefixes = new Set(readdirSync('workers/rollbacks').filter((name) => name.endsWith('.sql')).map((name) => name.slice(0, 4)));
for (const migration of migrations) {
  if (!rollbackPrefixes.has(migration.slice(0, 4))) failures.push(`Missing rollback for ${migration}`);
}

for (const required of ['workers/migrations/0044_create_ai_tutor_usage.sql', 'workers/rollbacks/0044_drop_ai_tutor_usage.sql']) {
  if (!existsSync(required) || !statSync(required).isFile()) failures.push(`Missing required migration artifact: ${required}`);
}

if (failures.length > 0) {
  console.error(`Security policy gates failed with ${failures.length} finding(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Security policy gates passed: CSP, CORS, browser auth and rollback policies verified.');
