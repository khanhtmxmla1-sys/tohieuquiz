// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  REQUIRED_RELEASE_CHECKS,
  validateCompetitionReleaseArtifacts,
  validateReleaseFlags,
} from '../scripts/release-readiness.mjs';
import {
  createCompetitionEventLogger,
  sanitizeCompetitionLogMetadata,
} from '../workers/src/competition/observability';

const greenCapacityReport = {
  benchmarkRunId: 'competition-release-100',
  build: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  config: { runtimeConfigVersion: 'cfg-1' },
  polling: { profileVersion: 'poll-1', statusRounds: 3 },
  summary: {
    concurrency: 100,
    statusP95Ms: 499,
    submitP95Ms: 1_999,
    lostAnswers: 0,
    duplicateFailures: 0,
    d1OverloadErrors: 0,
    app5xx: 0,
    networkErrors: 0,
  },
};

describe('Competition V1 release hardening', () => {
  it('treats the Competition rollout flag as an explicit release contract', () => {
    const env = {
      VITE_FEATURE_GIFT_SHOP_V2: 'false',
      VITE_FEATURE_AI_QUIZ_V2: 'false',
      VITE_FEATURE_AI_BLUEPRINT_V3: 'false',
      VITE_FEATURE_AI_SVG_DIAGRAMS: 'false',
      VITE_FEATURE_PARENT_PORTAL_V1: 'false',
      VITE_FEATURE_COMPETITION_V1: 'false',
      VITE_GIFT_SHOP_MODE: 'api',
    };
    expect(validateReleaseFlags(env)).toEqual([]);
    expect(validateReleaseFlags({ ...env, VITE_FEATURE_COMPETITION_V1: 'maybe' }))
      .toContain('VITE_FEATURE_COMPETITION_V1 must be true or false');
  });

  it('requires certified capacity evidence and an explicit rollback SHA before rollout', () => {
    expect(validateCompetitionReleaseArtifacts({ VITE_FEATURE_COMPETITION_V1: 'false' })).toEqual([]);
    expect(validateCompetitionReleaseArtifacts({ VITE_FEATURE_COMPETITION_V1: 'true' }))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('COMPETITION_CAPACITY_REPORT'),
        expect.stringContaining('COMPETITION_RELEASE_SHA'),
        expect.stringContaining('COMPETITION_ROLLBACK_SHA'),
        expect.stringContaining('COMPETITION_ROLLOUT_STAGE'),
      ]));

    const directory = mkdtempSync(join(tmpdir(), 'competition-release-'));
    const reportPath = join(directory, 'capacity.json');
    writeFileSync(reportPath, JSON.stringify(greenCapacityReport), 'utf8');
    try {
      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLBACK_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        COMPETITION_ROLLOUT_STAGE: 'internal',
      })).toEqual([]);

      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'cccccccccccccccccccccccccccccccccccccccc',
        COMPETITION_ROLLBACK_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        COMPETITION_ROLLOUT_STAGE: 'canary',
      })).toContain('COMPETITION_CAPACITY_REPORT build SHA must match COMPETITION_RELEASE_SHA');

      expect(validateCompetitionReleaseArtifacts({
        VITE_FEATURE_COMPETITION_V1: 'true',
        COMPETITION_CAPACITY_REPORT: reportPath,
        COMPETITION_RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLBACK_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        COMPETITION_ROLLOUT_STAGE: 'production',
      })).toEqual(expect.arrayContaining([
        'COMPETITION_ROLLBACK_SHA must differ from COMPETITION_RELEASE_SHA',
        'COMPETITION_ROLLOUT_STAGE must be internal, canary, or school-wide',
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('sanitizes structured operational events without answers or credentials', () => {
    const sanitized = sanitizeCompetitionLogMetadata({
      operation: 'student_round_attempt_submit',
      campaignId: 'campaign-1',
      eventId: 'event-1',
      status: 200,
      answers: { q1: 'A' },
      token: 'secret-token',
      nested: { requestId: 'req-1', password: 'secret-password' },
    });
    expect(sanitized).toEqual({
      operation: 'student_round_attempt_submit',
      campaignId: 'campaign-1',
      eventId: 'event-1',
      status: 200,
      nested: { requestId: 'req-1' },
    });

    const sink = { info: vi.fn(), warn: vi.fn() };
    const logger = createCompetitionEventLogger(sink);
    logger.info('mutation_completed', { operation: 'school_exam_publish', campaignId: 'campaign-1' });
    expect(sink.info).toHaveBeenCalledWith('[Competition] mutation_completed', {
      operation: 'school_exam_publish', campaignId: 'campaign-1',
    });
  });

  it('wires Competition regression, capacity, E2E and rollback guidance into release readiness', () => {
    expect(REQUIRED_RELEASE_CHECKS).toEqual(expect.arrayContaining([
      'competition-regression',
      'competition-capacity',
      'competition-e2e',
    ]));
    const workflow = readFileSync('.github/workflows/release-readiness.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const runbook = readFileSync('docs/operations/competition-v1-rollout.md', 'utf8');
    expect(workflow).toContain('VITE_FEATURE_COMPETITION_V1');
    expect(workflow).toContain('Verify Competition V1 release contracts');
    expect(packageJson.scripts['cypress:run:stubbed']).toContain('competition-v1.cy.ts');
    expect(runbook).toContain('COMPETITION_CAPACITY_REPORT');
    expect(runbook).toContain('COMPETITION_RELEASE_SHA');
    expect(runbook).toContain('COMPETITION_ROLLBACK_SHA');
    expect(runbook).toContain('COMPETITION_ROLLOUT_STAGE');
    expect(runbook).toContain('0078_competition_result_corrections.sql');
    expect(runbook).toContain('0078 to 0069');
    expect(runbook).toContain('internal → canary → school-wide');
    expect(runbook).toContain('VITE_FEATURE_COMPETITION_V1=false');
  });
});
