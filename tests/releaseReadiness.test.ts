import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  findDestructiveSql,
  REQUIRED_RELEASE_CHECKS,
  validateReleaseFlags,
  validateBundleEntries,
  runReleaseReadiness,
} from '../scripts/release-readiness.mjs';

const releaseEnv = {
  VITE_FEATURE_GIFT_SHOP_V2: 'false',
  VITE_FEATURE_AI_QUIZ_V2: 'false',
  VITE_FEATURE_AI_BLUEPRINT_V3: 'false',
  VITE_FEATURE_PARENT_PORTAL_V1: 'false',
  VITE_GIFT_SHOP_MODE: 'api',
};

describe('release readiness checks', () => {
  it('flags destructive migration statements but permits additive schema changes', () => {
    expect(findDestructiveSql('ALTER TABLE results ADD COLUMN assignment_id TEXT;')).toEqual([]);
    expect(findDestructiveSql('DROP TABLE results; DELETE FROM students; ALTER TABLE quizzes DROP COLUMN owner;'))
      .toEqual(['DROP TABLE', 'DELETE WITHOUT WHERE', 'DROP COLUMN']);
  });

  it('requires known flags and boolean rollout values', () => {
    expect(validateReleaseFlags(releaseEnv)).toEqual([]);
    expect(validateReleaseFlags({
      VITE_FEATURE_GIFT_SHOP_V2: 'maybe',
      VITE_FEATURE_UNKNOWN: 'true',
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('VITE_FEATURE_GIFT_SHOP_V2'),
      expect.stringContaining('VITE_FEATURE_UNKNOWN'),
    ]));
  });

  it('accepts inline and split base-ref arguments through the executable entry point', () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(runReleaseReadiness([
        '--base=HEAD',
        '--dist',
        'tests/fixtures/missing-release-dist',
      ], releaseEnv)).toBe(1);
    } finally {
      output.mockRestore();
    }
  });

  it('writes a machine-readable blocked report with the complete gate contract', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tohieuquiz-readiness-'));
    const outputPath = join(directory, 'readiness.json');
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      expect(runReleaseReadiness([
        '--base=HEAD',
        '--dist=tests/fixtures/missing-release-dist',
        `--output=${outputPath}`,
      ], releaseEnv)).toBe(1);
      const report = JSON.parse(readFileSync(outputPath, 'utf8'));
      expect(report.status).toBe('blocked');
      expect(report.requiredChecks).toEqual(REQUIRED_RELEASE_CHECKS);
      expect(report.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Missing build artifact'),
      ]));
    } finally {
      output.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects JavaScript chunks above the release limit', () => {
    expect(validateBundleEntries([
      { name: 'index.js', size: 200_000 },
      { name: 'docx.js', size: 520_000 },
    ], 550_000)).toEqual([]);
    expect(validateBundleEntries([{ name: 'oversized.js', size: 700_000 }], 550_000))
      .toEqual(['oversized.js is 700000 bytes (limit 550000)']);
  });

  it('runs on main and manual dispatch without containing a deployment command', () => {
    const workflow = readFileSync('.github/workflows/release-readiness.yml', 'utf8');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('npm run verify');
    expect(workflow).toContain('npm run perf:budget');
    expect(workflow).toContain('tests/d1MigrationLayout.test.ts');
    expect(workflow).toContain('npm run cypress:run:stubbed');
    expect(workflow).toContain('npm run cypress:run:blueprint-v3');
    expect(workflow).toContain('name: Release ready');
    expect(workflow).toContain('--output=reports/release-readiness-policy.json');
    expect(workflow).not.toMatch(/\b(?:wrangler\s+deploy|npm\s+run\s+deploy|vercel\s+deploy)\b/i);
  });

  it('tracks the required branch-protection and CODEOWNERS desired state', () => {
    const protection = readFileSync('.github/branch-protection.yml', 'utf8');
    const owners = readFileSync('.github/CODEOWNERS', 'utf8');
    const runbook = readFileSync('docs/operations/branch-protection.md', 'utf8');

    expect(protection).toContain('pull_request:');
    expect(protection).toContain('dismiss_stale_approvals: true');
    expect(protection).toContain('require_code_owner_reviews: true');
    expect(protection).toContain('allow_force_pushes: false');
    expect(protection).toContain('allow_direct_push: false');
    expect(protection).toContain('Vitest shard 1/2');
    expect(protection).toContain('Vitest shard 2/2');
    expect(protection).toContain('Cypress — stubbed specs (Blueprint V3 off)');
    expect(protection).toContain('Cypress — Blueprint V3 spec (Blueprint V3 on)');
    expect(protection).toContain('security');
    expect(protection).not.toContain('Security checks / security');
    expect(protection).not.toContain('Coverage threshold');
    expect(protection).not.toContain('Release readiness / Release ready');
    expect(owners).toContain('/workers/src/security/');
    expect(owners).toContain('/workers/migrations/');
    expect(runbook).toContain('File trong repository');
  });
});
