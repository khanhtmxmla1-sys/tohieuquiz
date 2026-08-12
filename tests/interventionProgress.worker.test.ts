// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { InterventionStudentSignal } from '../shared/intervention.contract';
import { buildInterventionGroupProgressFromData } from '../workers/src/services/interventionProgress';

const evaluatedAt = '2026-08-12T00:00:00.000Z';

const member = (
  studentId: string,
  baselineSkillAccuracy: number,
  baselineScore: number,
): InterventionStudentSignal => ({
  studentId,
  studentName: studentId,
  classId: 'class-1',
  className: '4A',
  latestResultId: `baseline-${studentId}`,
  latestSubmittedAt: '2026-08-01T00:00:00.000Z',
  firstAttemptScore: baselineScore,
  latestAttemptScore: baselineScore,
  scoreDelta: 0,
  attemptCount: 3,
  skillAccuracy: baselineSkillAccuracy,
  skillSampleSize: 3,
  confidence: 0.6,
  fourWeekTrend: [],
});

const assignment = (
  id: string,
  studentId: string,
  status = 'OPEN',
  deadline = '2026-08-20T00:00:00.000Z',
) => ({
  id,
  intervention_group_id: 'group-1',
  student_id: studentId,
  status,
  deadline,
  created_at: '2026-08-02T00:00:00.000Z',
});

const answer = (isCorrect: boolean) => ({
  selectedAnswer: isCorrect ? 'A' : 'B',
  isCorrect,
});

const result = (
  id: string,
  assignmentId: string,
  studentId: string,
  submittedAt: string,
  score: number,
  correctness: boolean[],
) => ({
  id,
  assignment_id: assignmentId,
  student_id: studentId,
  class_id: 'class-1',
  student_name: studentId,
  class_name: '4A',
  quiz_id: 'quiz-1',
  quiz_title: 'Luyện tập phân số',
  score,
  correct_count: correctness.filter(Boolean).length,
  total_questions: correctness.length,
  time_taken: 60,
  submitted_at: submittedAt,
  answers: JSON.stringify(Object.fromEntries(
    correctness.map((isCorrect, index) => [`q${index + 1}`, answer(isCorrect)]),
  )),
});

const questions = [1, 2, 3].map((index) => ({
  id: `q${index}`,
  quiz_id: 'quiz-1',
  type: 'MCQ',
  question: `Câu ${index}`,
  correct_answer: 'A',
  options: 'A|B|C|D',
  items: '',
  text_field: '',
  blanks: '',
  distractors: '',
  sentence: '',
  words: '',
  correct_word_indexes: '',
  image: '',
  tags: '',
  subject: 'math',
  skill_code: 'phan_so',
  subskill_code: '',
})) as any[];

const build = (input: {
  members: InterventionStudentSignal[];
  assignments?: ReturnType<typeof assignment>[];
  results?: ReturnType<typeof result>[];
}) => buildInterventionGroupProgressFromData({
  groupId: 'group-1',
  subject: 'math',
  skillCode: 'phan_so',
  members: input.members,
  assignments: input.assignments || [],
  results: input.results || [],
  questions,
  evaluatedAt,
});

describe('intervention progress derived from assignments/results', () => {
  it('returns NO_ASSIGNMENT without rewriting the baseline snapshot', () => {
    const baseline = member('student-1', 40, 5);
    const progress = build({ members: [baseline] });

    expect(progress).toMatchObject({
      status: 'NO_ASSIGNMENT',
      assignedCount: 0,
      completedCount: 0,
      completionPercent: 0,
      improvingCount: 0,
      needsAttentionCount: 0,
      waitingCount: 0,
      averageSkillAccuracyDelta: null,
      averageScoreDelta: null,
      evaluatedAt,
    });
    expect(progress.members[0]).toMatchObject({
      studentId: 'student-1',
      baselineSkillAccuracy: 40,
      currentSkillAccuracy: null,
      baselineScore: 5,
      currentScore: null,
      assignedCount: 0,
      completedCount: 0,
      postInterventionSampleSize: 0,
      status: 'NO_ASSIGNMENT',
    });
    expect(baseline.skillAccuracy).toBe(40);
    expect(baseline.latestAttemptScore).toBe(5);
  });

  it('waits for enough post-intervention skill samples and ignores revoked assignments', () => {
    const progress = build({
      members: [member('student-1', 40, 5)],
      assignments: [
        assignment('assignment-open', 'student-1'),
        assignment('assignment-expired', 'student-1', 'OPEN', '2026-08-03T00:00:00.000Z'),
        assignment('assignment-revoked', 'student-1', 'REVOKED'),
      ],
      results: [
        result('result-1', 'assignment-open', 'student-1', '2026-08-04T00:00:00.000Z', 6, [true, false]),
        result('revoked-result', 'assignment-revoked', 'student-1', '2026-08-05T00:00:00.000Z', 10, [true, true, true]),
      ],
    });

    expect(progress).toMatchObject({
      status: 'WAITING_FOR_RESULTS',
      assignedCount: 2,
      completedCount: 1,
      completionPercent: 50,
      waitingCount: 1,
    });
    expect(progress.members[0]).toMatchObject({
      assignedCount: 2,
      completedCount: 1,
      currentSkillAccuracy: null,
      skillAccuracyDelta: null,
      currentScore: 6,
      scoreDelta: 1,
      postInterventionSampleSize: 2,
      status: 'WAITING_FOR_RESULTS',
    });
  });

  it.each([
    { baseline: 40, correctness: [true, true, false], status: 'IMPROVING', delta: 27 },
    { baseline: 67, correctness: [true, true, false], status: 'STABLE', delta: 0 },
    { baseline: 80, correctness: [true, false, false], status: 'NEEDS_ATTENTION', delta: -47 },
  ] as const)('classifies $status only after three skill samples', ({ baseline, correctness, status, delta }) => {
    const progress = build({
      members: [member('student-1', baseline, 5)],
      assignments: [assignment('assignment-1', 'student-1')],
      results: [result('result-1', 'assignment-1', 'student-1', '2026-08-04T00:00:00.000Z', 7, [...correctness])],
    });

    expect(progress.status).toBe(status);
    expect(progress.members[0]).toMatchObject({
      currentSkillAccuracy: correctness.filter(Boolean).length === 2 ? 67 : 33,
      skillAccuracyDelta: delta,
      currentScore: 7,
      scoreDelta: 2,
      postInterventionSampleSize: 3,
      status,
    });
  });

  it('tracks partial completion and latest score across multiple attempts without mixing outside results', () => {
    const progress = build({
      members: [member('student-1', 50, 4)],
      assignments: [
        assignment('assignment-1', 'student-1'),
        assignment('assignment-2', 'student-1'),
      ],
      results: [
        result('result-old', 'assignment-1', 'student-1', '2026-08-04T00:00:00.000Z', 5, [true, false, false]),
        result('result-latest', 'assignment-1', 'student-1', '2026-08-05T00:00:00.000Z', 8, [true, true, true]),
        result('outside-assignment', 'assignment-outside', 'student-1', '2026-08-06T00:00:00.000Z', 10, [true, true, true]),
        result('outside-student', 'assignment-2', 'student-2', '2026-08-07T00:00:00.000Z', 10, [true, true, true]),
      ],
    });

    expect(progress).toMatchObject({ assignedCount: 2, completedCount: 1, completionPercent: 50 });
    expect(progress.members[0]).toMatchObject({
      currentSkillAccuracy: 67,
      skillAccuracyDelta: 17,
      currentScore: 8,
      scoreDelta: 4,
      postInterventionSampleSize: 6,
      assignedCount: 2,
      completedCount: 1,
      lastResultAt: '2026-08-05T00:00:00.000Z',
      status: 'IMPROVING',
    });
  });
});
