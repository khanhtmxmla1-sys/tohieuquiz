import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRootApiWranglerToml,
  isApiWorkersBuild,
  prepareRootApiConfig,
} from '../scripts/cloudflare-build-router.mjs';

describe('Cloudflare build router', () => {
  it('only selects the API build for the connected API Worker', () => {
    expect(isApiWorkersBuild({ WORKERS_CI: '1', WRANGLER_CI_OVERRIDE_NAME: 'tohieuquiz-api' })).toBe(true);
    expect(isApiWorkersBuild({ WORKERS_CI: '1', WRANGLER_CI_OVERRIDE_NAME: 'tohieuquiz-web' })).toBe(false);
    expect(isApiWorkersBuild({ WRANGLER_CI_OVERRIDE_NAME: 'tohieuquiz-api' })).toBe(false);
  });

  it('moves the API entry point from workers-relative to repository-relative', () => {
    const source = 'name = "tohieuquiz-api"\nmain = "src/index.ts"\n';
    expect(createRootApiWranglerToml(source)).toContain('main = "workers/src/index.ts"');
  });

  it('declares authentication and AI proxy secrets as required for deployment', () => {
    const config = readFileSync(join(process.cwd(), 'workers', 'wrangler.toml'), 'utf8');
    expect(config).toContain('[secrets]');
    expect(config).toMatch(/required\s*=\s*\[[^\]]*"JWT_SECRET"[^\]]*"CLIPROXY_TOKEN"[^\]]*\]/s);
  });

  it('replaces the root frontend config with the API config in an ephemeral build workspace', () => {
    const root = mkdtempSync(join(tmpdir(), 'tohieuquiz-build-router-'));
    const workersDirectory = join(root, 'workers');
    mkdirSync(workersDirectory);
    mkdirSync(join(root, '.wrangler', 'deploy'), { recursive: true });
    writeFileSync(join(root, '.wrangler', 'deploy', 'config.json'), '{}', 'utf8');
    writeFileSync(join(root, 'wrangler.jsonc'), '{"name":"frontend"}\n', 'utf8');
    writeFileSync(
      join(workersDirectory, 'wrangler.toml'),
      'name = "tohieuquiz-api"\nmain = "src/index.ts"\n[[routes]]\npattern = "api.thtohieu.com/*"\n',
      'utf8',
    );

    const result = prepareRootApiConfig(root);

    expect(readFileSync(result.frontendBackupPath, 'utf8')).toContain('frontend');
    expect(existsSync(join(root, '.wrangler', 'deploy'))).toBe(false);
    const generated = readFileSync(result.rootApiConfigPath, 'utf8');
    expect(generated).toContain('name = "tohieuquiz-api"');
    expect(generated).toContain('main = "workers/src/index.ts"');
    expect(generated).toContain('api.thtohieu.com/*');
  });
});
