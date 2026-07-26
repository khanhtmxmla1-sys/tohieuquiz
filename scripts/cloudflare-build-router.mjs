import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const API_WORKER_NAME = 'tohieuquiz-api';
const FRONTEND_CONFIG_BACKUP = '.wrangler.frontend.jsonc';

export function isApiWorkersBuild(env = process.env) {
  return env.WORKERS_CI === '1' && env.WRANGLER_CI_OVERRIDE_NAME === API_WORKER_NAME;
}

export function createRootApiWranglerToml(source) {
  const mainPattern = /^main\s*=\s*["']src\/index\.ts["']\s*$/m;
  if (!mainPattern.test(source)) {
    throw new Error('workers/wrangler.toml is missing the expected main = "src/index.ts" entry.');
  }
  return source.replace(mainPattern, 'main = "workers/src/index.ts"');
}

export function prepareRootApiConfig(rootDirectory = process.cwd()) {
  const frontendConfigPath = join(rootDirectory, 'wrangler.jsonc');
  const frontendBackupPath = join(rootDirectory, FRONTEND_CONFIG_BACKUP);
  const sourceApiConfigPath = join(rootDirectory, 'workers', 'wrangler.toml');
  const rootApiConfigPath = join(rootDirectory, 'wrangler.toml');
  const generatedDeployConfigPath = join(rootDirectory, '.wrangler', 'deploy');

  if (!existsSync(sourceApiConfigPath)) {
    throw new Error(`Missing API Wrangler config: ${sourceApiConfigPath}`);
  }

  const source = readFileSync(sourceApiConfigPath, 'utf8');
  const rootConfig = createRootApiWranglerToml(source);

  if (existsSync(frontendConfigPath)) {
    rmSync(frontendBackupPath, { force: true });
    renameSync(frontendConfigPath, frontendBackupPath);
  }
  rmSync(generatedDeployConfigPath, { recursive: true, force: true });
  writeFileSync(rootApiConfigPath, rootConfig, 'utf8');

  return { frontendBackupPath, rootApiConfigPath };
}

function run(command, args) {
  const isWindows = process.platform === 'win32';
  const executable = isWindows ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = isWindows
    ? ['/d', '/s', '/c', [command, ...args].join(' ')]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}.`);
  }
}

export function runBuild(env = process.env) {
  const npmCommand = 'npm';
  const npxCommand = 'npx';

  if (!isApiWorkersBuild(env)) {
    run(npmCommand, ['run', 'build:frontend']);
    return 'frontend';
  }

  process.stdout.write(`[build-router] Preparing Cloudflare Workers build for ${API_WORKER_NAME}.\n`);
  run(npmCommand, ['ci', '--prefix', 'workers', '--ignore-scripts']);
  run(npxCommand, ['tsc', '--noEmit', '--project', 'workers/tsconfig.json']);
  prepareRootApiConfig();
  process.stdout.write('[build-router] Root Wrangler config now points to workers/src/index.ts.\n');
  return 'api';
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  try {
    runBuild();
  } catch (error) {
    console.error('[build-router] Build failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
