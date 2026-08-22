// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_EXTERNAL_GATES,
  XLSX_MIME,
  buildEvidenceReport,
  evaluateArtifactJourneyOutcome,
  sanitizeEvidence,
  validateExternalEvidence,
} from '../workers/scripts/rehearse-competition-artifact-journey.cjs';

const candidateSha = 'a'.repeat(40);

function completeExternalEvidence() {
  return {
    candidateSha,
    ...Object.fromEntries(REQUIRED_EXTERNAL_GATES.map((gate) => [gate, {
      status: 'PASS',
      requestIds: ['req-1'],
      queueAttempts: [1, 2],
    }])),
    artifact: {
      mime: XLSX_MIME,
      sizeBytes: 2048,
      sha256: 'b'.repeat(64),
    },
  };
}

describe('Competition V1 Queue/R2 artifact journey rehearsal contract', () => {
  it('fails closed when real external evidence is absent', () => {
    expect(evaluateArtifactJourneyOutcome({
      candidateSha,
      externalEvidence: null,
    })).toEqual({
      status: 'BLOCKED',
      externalStatus: 'BLOCKED',
      blockingGaps: [
        'real_queue_acceptance_missing',
        'real_r2_artifact_validation_missing',
        'certificate_linkage_missing',
        'retry_behavior_missing',
        'audit_evidence_missing',
      ],
    });
  });

  it('requires a candidate-bound XLSX artifact and every real gate', () => {
    const evidence = completeExternalEvidence();
    expect(validateExternalEvidence(evidence, candidateSha)).toEqual({ valid: true, errors: [] });
    expect(evaluateArtifactJourneyOutcome({ candidateSha, externalEvidence: evidence })).toMatchObject({
      status: 'PASS',
      externalStatus: 'PASS',
      blockingGaps: [],
    });
    expect(validateExternalEvidence({ ...evidence, candidateSha: 'c'.repeat(40) }, candidateSha).errors)
      .toContain('candidate_sha_mismatch');
    expect(validateExternalEvidence({ ...evidence, artifact: { ...evidence.artifact, mime: 'text/csv' } }, candidateSha).errors)
      .toContain('xlsx_mime_invalid');
  });

  it('sanitizes evidence before persisting it', () => {
    expect(sanitizeEvidence({
      requestId: 'req-1',
      queueAttempts: [1, 2],
      answers: { q1: 'A' },
      accessCode: 'secret',
      nested: { token: 'secret-token', artifactSha256: 'b'.repeat(64) },
    })).toEqual({
      requestId: 'req-1',
      queueAttempts: [1, 2],
      nested: { artifactSha256: 'b'.repeat(64) },
    });
  });

  it('marks an uncommitted rehearsal as blocked even when external evidence is complete', () => {
    const report = buildEvidenceReport({
      candidateSha,
      externalEvidence: completeExternalEvidence(),
      treeDirty: true,
      generatedAt: '2026-08-22T00:00:00.000Z',
    });
    expect(report).toMatchObject({
      status: 'BLOCKED',
      blockingGaps: ['candidate_worktree_dirty'],
      candidateSha,
      generatedAt: '2026-08-22T00:00:00.000Z',
      safety: { remoteWritesAttempted: false, secretsIncluded: false },
    });
    expect(JSON.stringify(report)).not.toContain('secret-token');
  });
});
