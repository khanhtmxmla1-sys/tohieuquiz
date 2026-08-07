import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KNOWN_FLAGS = new Set([
  'VITE_FEATURE_GIFT_SHOP_V2',
  'VITE_FEATURE_AI_QUIZ_V2',
  'VITE_FEATURE_AI_BLUEPRINT_V3',
  'VITE_FEATURE_AI_SVG_DIAGRAMS',
  'VITE_FEATURE_PARENT_PORTAL_V1',
]);

const stripSqlComments = sql => String(sql)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--.*$/gm, ' ');

export function findDestructiveSql(sql) {
  const findings = [];
  const statements = stripSqlComments(sql)
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const matches = [];
    const dropTableIndex = statement.search(/\bDROP\s+TABLE\b/i);
    const deleteIndex = statement.search(/\bDELETE\s+FROM\b/i);
    const dropColumnIndex = statement.search(/\bDROP\s+COLUMN\b/i);

    if (dropTableIndex >= 0) matches.push({ index: dropTableIndex, finding: 'DROP TABLE' });
    if (deleteIndex >= 0 && !/\bWHERE\b/i.test(statement)) {
      matches.push({ index: deleteIndex, finding: 'DELETE WITHOUT WHERE' });
    }
    if (dropColumnIndex >= 0) matches.push({ index: dropColumnIndex, finding: 'DROP COLUMN' });

    matches.sort((left, right) => left.index - right.index);
    for (const { finding } of matches) {
      if (!findings.includes(finding)) findings.push(finding);
    }
  }
  return findings;
}

export function validateReleaseFlags(values) {
  const errors = [];
  for (const [name, value] of Object.entries(values)) {
    if (name.startsWith('VITE_FEATURE_') && !KNOWN_FLAGS.has(name)) {
      errors.push(`Unknown release flag: ${name}`);
      continue;
    }
    if (KNOWN_FLAGS.has(name) && !['true', 'false'].includes(String(value).toLowerCase())) {
      errors.push(`${name} must be true or false`);
    }
  }
  for (const name of KNOWN_FLAGS) {
    if (!(name in values)) errors.push(`Missing release flag: ${name}`);
  }
  if (values.VITE_GIFT_SHOP_MODE !== 'api') errors.push('VITE_GIFT_SHOP_MODE must be api for release');
  return errors;
}

const isAllowedBundleEntry = (entry, allowlist, now = new Date()) => allowlist.some(exception => {
  if (exception.metric !== 'singleChunkMinifiedBytes' || !exception.reason || !exception.expires) return false;
  if (new Date(exception.expires) <= now) return false;
  if (!exception.assetPattern || !Number.isFinite(Number(exception.maxBytes))) return false;
  try {
    return new RegExp(exception.assetPattern).test(entry.name) && entry.size <= Number(exception.maxBytes);
  } catch {
    return false;
  }
});

export function validateBundleEntries(entries, maxBytes, allowlist = [], now = new Date()) {
  return entries
    .filter(entry => (
      entry.name.endsWith('.js')
      && entry.size > maxBytes
      && !isAllowedBundleEntry(entry, allowlist, now)
    ))
    .map(entry => `${entry.name} is ${entry.size} bytes (limit ${maxBytes})`);
}

const listFiles = (directory, root = directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory()
    ? listFiles(path, root)
    : [{ name: relative(root, path).replaceAll('\\', '/'), size: statSync(path).size }];
});

const readArg = (args, names, fallback) => {
  const acceptedNames = Array.isArray(names) ? names : [names];
  for (const name of acceptedNames) {
    const exactIndex = args.indexOf(name);
    if (exactIndex >= 0 && args[exactIndex + 1]) return args[exactIndex + 1];
    const prefix = `${name}=`;
    const inlineValue = args.find(argument => argument.startsWith(prefix));
    if (inlineValue) return inlineValue.slice(prefix.length);
  }
  return fallback;
};

export const REQUIRED_RELEASE_CHECKS = [
  'lint',
  'typecheck-frontend',
  'typecheck-strict',
  'typecheck-workers',
  'vitest-all-shards',
  'coverage',
  'build',
  'performance-budget',
  'security-root-workers',
  'migration-contracts',
  'cypress-v2',
  'cypress-v3',
];

export function writeReleaseReadinessReport(outputPath, report) {
  if (!outputPath) return;
  const absolutePath = resolve(outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}
`, 'utf8');
}

export function runReleaseReadiness(args = process.argv.slice(2), env = process.env) {
  const dist = resolve(readArg(args, '--dist', 'dist'));
  const baseRef = readArg(args, ['--base', '--base-ref'], env.RELEASE_BASE_REF || 'origin/main');
  const outputPath = readArg(args, '--output', env.RELEASE_READINESS_OUTPUT || '');
  const maxJsBytes = Number(readArg(args, '--max-js-bytes', '563200'));
  const errors = [];

  if (!existsSync(resolve(dist, 'index.html'))) errors.push(`Missing build artifact: ${resolve(dist, 'index.html')}`);
  let bundleAllowlist = [];
  try {
    const performanceBudget = JSON.parse(readFileSync(resolve('config/performance-budget.json'), 'utf8'));
    bundleAllowlist = Array.isArray(performanceBudget.allowlist) ? performanceBudget.allowlist : [];
  } catch (error) {
    errors.push(`Unable to read performance budget allowlist: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (existsSync(dist)) errors.push(...validateBundleEntries(listFiles(dist), maxJsBytes, bundleAllowlist));

  const flagValues = Object.fromEntries(
    Object.entries(env).filter(([name]) => name.startsWith('VITE_FEATURE_') || name === 'VITE_GIFT_SHOP_MODE'),
  );
  errors.push(...validateReleaseFlags(flagValues));

  let changedMigrations = [];
  try {
    const output = execFileSync('git', [
      'diff', '--name-only', `${baseRef}...HEAD`, '--', 'workers/migrations/*.sql',
    ], { encoding: 'utf8' });
    changedMigrations = output.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    errors.push(`Unable to compare migrations with ${baseRef}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const migration of changedMigrations) {
    const findings = findDestructiveSql(readFileSync(migration, 'utf8'));
    for (const finding of findings) errors.push(`${migration}: destructive statement ${finding}`);
  }

  const report = {
    status: errors.length === 0 ? 'ready' : 'blocked',
    generatedAt: new Date().toISOString(),
    baseRef,
    maxJsBytes,
    requiredChecks: REQUIRED_RELEASE_CHECKS,
    changedMigrations,
    errors,
  };
  writeReleaseReadinessReport(outputPath, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}
`);
  return errors.length === 0 ? 0 : 1;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntryPoint) process.exitCode = runReleaseReadiness();
