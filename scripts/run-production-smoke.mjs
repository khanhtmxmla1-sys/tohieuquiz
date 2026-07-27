import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

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

const readArg = (args, name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

export function runProductionSmoke(args = process.argv.slice(2)) {
  const allowLocal = args.includes('--allow-local');
  const siteUrl = normalizeSmokeUrl(readArg(args, '--site'), allowLocal);
  const apiUrl = normalizeSmokeUrl(readArg(args, '--api'), allowLocal);
  const parentUrl = normalizeSmokeUrl(readArg(args, '--parent'), allowLocal);

  const cypressCli = resolve(dirname(require.resolve('cypress')), '..', 'bin', 'cypress');
  const result = spawnSync(
    process.execPath,
    [
      cypressCli,
      'run',
      '--e2e',
      '--spec',
      'cypress/e2e/production-smoke.cy.ts',
      '--config',
      `baseUrl=${siteUrl}`,
      '--env',
      `apiBaseUrl=${apiUrl},parentBaseUrl=${parentUrl}`,
    ],
    { stdio: 'inherit', env: process.env },
  );

  if (result.error) throw result.error;
  return result.status ?? 1;
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntryPoint) process.exitCode = runProductionSmoke();
