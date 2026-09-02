// @vitest-environment node
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const scriptUrl = new URL('../workers/scripts/seed-staging-capacity-profile.cjs', import.meta.url);

const certifiedProfile = {
  profileId: 'live-capacity-profile-1',
  benchmarkRunId: 'run-staging-1',
  buildSha: '3c12726a647a44d87cf2fe7c338676d51bf87cd9',
  runtimeConfigVersion: 'staging-runtime-v1',
  pollingProfileVersion: 'polling-v1',
  certifiedConcurrentStudents: 100,
  statusP95Ms: 120,
  submitP95Ms: 600,
  lostAnswers: 0,
  duplicateFailures: 0,
  d1Overload: 0,
  app5xx: 0,
  networkErrors: 0,
  status: 'CERTIFIED',
  passedAt: '2026-08-31T01:00:00.000Z',
  createdAt: '2026-08-31T01:00:00.000Z',
};

describe('staging capacity profile seeding guard', () => {
  it('fails closed unless the target config is explicitly isolated staging', async () => {
    const module = require(fileURLToPath(scriptUrl));
    expect(() => module.validateStagingSeedTarget({
      database: 'tohieuquiz-db',
      confirmStaging: 'tohieuquiz-db',
      configText: 'workers_dev = false\nENVIRONMENT = "production"',
    })).toThrow(/staging|production/i);
  });

  it('requires an exact staging confirmation and candidate SHA match', async () => {
    const module = require(fileURLToPath(scriptUrl));
    const configText = [
      'name = "tohieuquiz-competition-stg-test"',
      'workers_dev = true',
      '[[d1_databases]]',
      'database_name = "tohieuquiz-competition-stg-test"',
      '[vars]',
      'ENVIRONMENT = "staging"',
    ].join('\n');
    expect(() => module.validateStagingSeedTarget({
      database: 'tohieuquiz-competition-stg-test',
      confirmStaging: 'wrong-database',
      configText,
    })).toThrow(/confirm/i);
    expect(() => module.validateCandidateProfile(certifiedProfile, 'a'.repeat(40)))
      .toThrow(/build SHA/i);
  });

  it('builds an idempotent, secret-free insert for a certified profile', async () => {
    const module = require(fileURLToPath(scriptUrl));
    const sql = module.buildCapacitySeedSql(certifiedProfile);
    expect(sql).toContain('INSERT OR IGNORE INTO live_exam_capacity_profiles');
    expect(sql).toContain("'run-staging-1'");
    expect(sql).toContain("'CERTIFIED'");
    expect(sql).not.toMatch(/cookie|password|token|secret/i);
  });
});
