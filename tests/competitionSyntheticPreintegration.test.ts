// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildSyntheticPreintegrationDataset,
  containsSensitiveKeys,
} from '../workers/scripts/build-competition-synthetic-preintegration.cjs';

const candidateSha = 'a'.repeat(40);

describe('Competition V1 synthetic pre-integration dataset', () => {
  it('builds a deterministic 120-student, four-class, six-round journey', () => {
    const dataset = buildSyntheticPreintegrationDataset({ candidateSha });

    expect(dataset).toMatchObject({
      classification: 'SYNTHETIC/LOCAL',
      productionEvidence: false,
      candidateSha,
      status: 'LOCAL_PASS_EXTERNAL_BLOCKED',
      featureFlagRequired: false,
      counts: {
        classes: 4,
        students: 120,
        rounds: 6,
        roundProgressRows: 720,
        qualifiedStudents: 90,
        rooms: 4,
        publicationResults: 90,
      },
    });
    expect(dataset.campaign.rounds).toHaveLength(6);
    expect(dataset.schoolExam.rooms).toHaveLength(4);
    expect(dataset.schoolExam.rooms.flatMap((room: any) => room.members)).toHaveLength(90);
    expect(dataset.publication.results).toHaveLength(90);
    expect(dataset.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves original class ownership through room membership and publication', () => {
    const dataset = buildSyntheticPreintegrationDataset({ candidateSha });
    const studentClass = new Map(dataset.students.map((student: any) => [student.id, student.originalClassId]));

    for (const room of dataset.schoolExam.rooms) {
      for (const member of room.members) {
        expect(member.originalClassId).toBe(studentClass.get(member.studentId));
      }
    }
    for (const result of dataset.publication.results) {
      expect(result.originalClassId).toBe(studentClass.get(result.studentId));
    }
  });

  it('contains the WP6 negative-security matrix without secrets or answer payloads', () => {
    const dataset = buildSyntheticPreintegrationDataset({ candidateSha });
    expect(dataset.securityMatrix.map((item: any) => item.id)).toEqual([
      'student_cross_read',
      'student_identity_override',
      'teacher_cross_class_read',
      'invigilator_publish',
      'invigilator_grant_retest',
      'unassigned_teacher_incident',
      'room_code_only_join',
      'raw_result_embargo',
      'blocking_reconcile_publish',
      'immutable_publication_edit',
      'export_scope_bypass',
    ]);
    expect(dataset.securityMatrix.every((item: any) => item.expected === 'DENY')).toBe(true);
    expect(containsSensitiveKeys(dataset)).toBe(false);
    expect(JSON.stringify(dataset)).not.toMatch(/password|authorization|access.?code|answers?|token/i);
  });

  it('keeps real WP3-WP5 gates blocked and rejects invalid generation inputs', () => {
    const dataset = buildSyntheticPreintegrationDataset({ candidateSha });
    expect(dataset.externalBlockers).toEqual([
      'WP3_REPRESENTATIVE_D1_AND_ROLLBACK_EVIDENCE_MISSING',
      'WP4_REAL_QUEUE_R2_CERTIFICATE_EVIDENCE_MISSING',
      'WP5_CANDIDATE_CAPACITY_BENCHMARK_MISSING',
    ]);
    expect(() => buildSyntheticPreintegrationDataset({ candidateSha: 'abc123' }))
      .toThrow(/candidateSha/);
    expect(() => buildSyntheticPreintegrationDataset({ candidateSha, studentCount: 10, classCount: 4 }))
      .toThrow(/studentCount/);
  });
});
