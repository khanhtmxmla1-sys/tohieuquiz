import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('security workflow configuration', () => {
  it('installs and audits both frontend and Worker lockfiles', () => {
    const workflow = readFileSync('.github/workflows/security.yml', 'utf8');
    expect(workflow).toContain('npm ci --prefix workers --ignore-scripts');
    expect(workflow).toContain('npm run audit:dependencies:all:enforce');
  });

  it('configures weekly dependency updates for root and workers', () => {
    const dependabot = readFileSync('.github/dependabot.yml', 'utf8');
    expect(dependabot).toContain('directory: /');
    expect(dependabot).toContain('directory: /workers');
  });

  it('enforces history and policy gates before dependency audit', () => {
    const workflow = readFileSync('.github/workflows/security.yml', 'utf8');
    expect(workflow).toContain('npm run security:history');
    expect(workflow).toContain('npm run security:policies');
    const packageJson = readFileSync('package.json', 'utf8');
    expect(packageJson).toContain('security-history-scan.mjs');
    expect(packageJson).toContain('security-policy-gates.mjs');
  });

  it('enforces bundle budgets in the production build job', () => {
    expect(readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('npm run perf:budget');
  });
});
