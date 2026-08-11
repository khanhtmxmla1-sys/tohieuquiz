import { describe, expect, it } from 'vitest';
import { isInterventionSignalEligible } from '../shared/intervention.contract';
import type { Question } from '../workers/src/types';
import { buildInterventionSuggestionsFromData } from '../workers/src/services/interventionService';

const answer = (isCorrect: boolean) => ({
  selectedAnswer: isCorrect ? 'A' : 'B',
  isCorrect,
});

const question = (id: string): Question => ({
  id,
  quiz_id: 'quiz-source',
  type: 'MCQ',
  question: 'Phân số nào lớn hơn?',
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
} as Question);

const result = (overrides: Record<string, unknown>) => ({
  id: 'result-1',
  student_id: 'student-1',
  class_id: 'class-4a',
  student_name: 'Lan',
  class_name: '4A',
  quiz_id: 'quiz-source',
  quiz_title: 'Kiểm tra phân số',
  score: 4,
  correct_count: 0,
  total_questions: 1,
  time_taken: 60,
  submitted_at: '2026-07-08T08:00:00.000Z',
  answers: JSON.stringify({ q1: answer(false) }),
  ...overrides,
});

describe('Results Intervention suggestion model', () => {
  it('requires enough samples and confidence, then exposes first/latest and four-week trends', () => {
    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students: [
        { id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' },
        { id: 'student-2', full_name: 'Minh', class_id: 'class-4a', class_name: '4A' },
      ],
      results: [
        result({ id: 'r1', submitted_at: '2026-07-08T08:00:00.000Z', score: 4 }),
        result({ id: 'r2', submitted_at: '2026-07-16T08:00:00.000Z', score: 5 }),
        result({ id: 'r3', submitted_at: '2026-07-24T08:00:00.000Z', score: 6, answers: JSON.stringify({ q1: answer(true) }) }),
        result({ id: 'r4', student_id: 'student-2', student_name: 'Minh', submitted_at: '2026-07-09T08:00:00.000Z', score: 3 }),
        result({ id: 'r5', student_id: 'student-2', student_name: 'Minh', submitted_at: '2026-07-17T08:00:00.000Z', score: 4 }),
        result({ id: 'r6', student_id: 'student-2', student_name: 'Minh', submitted_at: '2026-07-25T08:00:00.000Z', score: 4.5 }),
      ] as any,
      questions: [question('q1')],
      recommendationRows: [
        { quiz_id: 'quiz-practice', title: 'Luyện tập phân số', subject: 'math', skill_code: 'phan_so' },
        { quiz_id: 'quiz-practice', title: 'Luyện tập phân số', subject: 'math', skill_code: 'phan_so' },
        { quiz_id: 'quiz-other', title: 'Hình học', subject: 'math', skill_code: 'hinh_hoc' },
      ],
    });

    expect(suggestions).toHaveLength(1);
    const suggestion = suggestions[0];
    expect(suggestion.title).toBe('Cần hỗ trợ ở Phân số');
    expect(suggestion.title.toLowerCase()).not.toContain('yếu');
    expect(suggestion).toEqual(expect.objectContaining({
      classId: 'class-4a',
      skillCode: 'phan_so',
      sampleSize: 6,
      studentCount: 2,
      confidence: 0.6,
    }));
    expect(suggestion.students[0].fourWeekTrend).toHaveLength(4);
    expect(suggestion.students.find((student) => student.studentId === 'student-1')).toEqual(
      expect.objectContaining({
        firstAttemptScore: 4,
        latestAttemptScore: 6,
        scoreDelta: 2,
        attemptCount: 3,
        skillSampleSize: 3,
      }),
    );
    expect(suggestion.recommendedQuizzes[0]).toEqual(expect.objectContaining({
      quizId: 'quiz-practice',
      matchedQuestionCount: 2,
      confidence: 1,
    }));
  });

  it('groups four-week trends by Hanoi Monday boundaries', () => {
    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-08-03T01:00:00.000Z'),
      students: [{ id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' }],
      results: [
        result({ id: 'r-prev', submitted_at: '2026-08-02T16:59:59.999Z', score: 4 }),
        result({ id: 'r-current-1', submitted_at: '2026-08-02T17:00:00.000Z', score: 5 }),
        result({ id: 'r-current-2', submitted_at: '2026-08-02T18:00:00.000Z', score: 6 }),
      ] as any,
      questions: [question('q1')],
      recommendationRows: [],
    });

    expect(suggestions).toHaveLength(1);
    const trend = suggestions[0].students[0].fourWeekTrend;
    expect(trend[2]).toMatchObject({ weekStart: '2026-07-27', attemptCount: 1 });
    expect(trend[3]).toMatchObject({ weekStart: '2026-08-03', attemptCount: 2 });
  });

  it('does not surface a skill with fewer than three classified attempts', () => {
    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students: [{ id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' }],
      results: [
        result({ id: 'r1' }),
        result({ id: 'r2', submitted_at: '2026-07-20T08:00:00.000Z' }),
      ] as any,
      questions: [question('q1')],
      recommendationRows: [],
    });

    expect(suggestions).toEqual([]);
  });

  it('keeps the current sample and confidence thresholds at 3 samples and 0.55', () => {
    expect(isInterventionSignalEligible(2, 1)).toBe(false);
    expect(isInterventionSignalEligible(3, 0.54)).toBe(false);
    expect(isInterventionSignalEligible(3, 0.55)).toBe(true);
  });

  it('excludes stable skills even when they have enough samples and confidence', () => {
    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students: [{ id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' }],
      results: [
        result({ id: 'r1', answers: JSON.stringify({ q1: answer(true) }) }),
        result({ id: 'r2', submitted_at: '2026-07-20T08:00:00.000Z', answers: JSON.stringify({ q1: answer(true) }) }),
        result({ id: 'r3', submitted_at: '2026-07-24T08:00:00.000Z', answers: JSON.stringify({ q1: answer(true) }) }),
      ] as any,
      questions: [question('q1')],
      recommendationRows: [],
    });

    expect(suggestions).toEqual([]);
  });

  it('preserves suggestion sort order and caps the dashboard list at 12 groups', () => {
    const students = Array.from({ length: 13 }, (_, index) => ({
      id: `student-${index + 1}`,
      full_name: `Học sinh ${index + 1}`,
      class_id: `class-${String(index + 1).padStart(2, '0')}`,
      class_name: `Lớp ${String(index + 1).padStart(2, '0')}`,
    }));
    const results = students.flatMap((student, studentIndex) => Array.from({ length: 3 }, (_, attemptIndex) => result({
      id: `r-${studentIndex + 1}-${attemptIndex + 1}`,
      student_id: student.id,
      student_name: student.full_name,
      class_id: student.class_id,
      class_name: student.class_name,
      submitted_at: `2026-07-${String(10 + attemptIndex).padStart(2, '0')}T08:00:00.000Z`,
    })));

    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students,
      results: results as any,
      questions: [question('q1')],
      recommendationRows: [],
    });

    expect(suggestions).toHaveLength(12);
    expect(suggestions.map((item) => item.classId)).toEqual(students.slice(0, 12).map((student) => student.class_id));
  });

  it('preserves recommendation ranking and caps recommendations at three quizzes', () => {
    const recommendationRows = [
      ...Array.from({ length: 3 }, () => ({ quiz_id: 'quiz-perfect', title: 'A · Khớp hoàn toàn', subject: 'math', skill_code: 'phan_so' })),
      { quiz_id: 'quiz-good', title: 'B · Khớp tốt', subject: 'math', skill_code: 'phan_so' },
      { quiz_id: 'quiz-good', title: 'B · Khớp tốt', subject: 'math', skill_code: 'phan_so' },
      { quiz_id: 'quiz-good', title: 'B · Khớp tốt', subject: 'math', skill_code: 'hinh_hoc' },
      { quiz_id: 'quiz-fair', title: 'C · Khớp vừa', subject: 'math', skill_code: 'phan_so' },
      { quiz_id: 'quiz-fair', title: 'C · Khớp vừa', subject: 'math', skill_code: 'hinh_hoc' },
      { quiz_id: 'quiz-fair', title: 'C · Khớp vừa', subject: 'math', skill_code: 'hinh_hoc' },
      { quiz_id: 'quiz-low', title: 'D · Khớp thấp', subject: 'math', skill_code: 'phan_so' },
      ...Array.from({ length: 3 }, () => ({ quiz_id: 'quiz-low', title: 'D · Khớp thấp', subject: 'math', skill_code: 'hinh_hoc' })),
    ];
    const suggestions = buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students: [{ id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' }],
      results: [
        result({ id: 'r1' }),
        result({ id: 'r2', submitted_at: '2026-07-20T08:00:00.000Z' }),
        result({ id: 'r3', submitted_at: '2026-07-24T08:00:00.000Z' }),
      ] as any,
      questions: [question('q1')],
      recommendationRows,
    });

    expect(suggestions[0].recommendedQuizzes.map((quiz) => quiz.quizId)).toEqual([
      'quiz-perfect',
      'quiz-good',
      'quiz-fair',
    ]);
  });

  it('returns deterministic evidence for low accuracy, declining trend, and persistent weakness', () => {
    const buildSuggestion = (results: ReturnType<typeof result>[]) => buildInterventionSuggestionsFromData({
      now: new Date('2026-07-29T08:00:00.000Z'),
      students: [{ id: 'student-1', full_name: 'Lan', class_id: 'class-4a', class_name: '4A' }],
      results: results as any,
      questions: [question('q1')],
      recommendationRows: [],
    })[0] as any;

    const lowAccuracy = buildSuggestion([
      result({ id: 'low-1', submitted_at: '2026-07-10T08:00:00.000Z', score: 4 }),
      result({ id: 'low-2', submitted_at: '2026-07-17T08:00:00.000Z', score: 4 }),
      result({ id: 'low-3', submitted_at: '2026-07-24T08:00:00.000Z', score: 4 }),
    ]);
    expect(lowAccuracy.evidence).toEqual(expect.objectContaining({
      reason: 'LOW_ACCURACY',
      averageSkillAccuracy: 0,
      minimumSkillAccuracy: 0,
      recentAttemptCount: 3,
      improvingStudentCount: 0,
      unchangedStudentCount: 1,
      decliningStudentCount: 0,
    }));

    const declining = buildSuggestion([
      result({ id: 'decline-1', submitted_at: '2026-07-10T08:00:00.000Z', score: 7 }),
      result({ id: 'decline-2', submitted_at: '2026-07-17T08:00:00.000Z', score: 6 }),
      result({ id: 'decline-3', submitted_at: '2026-07-24T08:00:00.000Z', score: 5 }),
    ]);
    expect(declining.evidence.reason).toBe('DECLINING_TREND');
    expect(declining.evidence.decliningStudentCount).toBe(1);

    const persistent = buildSuggestion([
      result({ id: 'persistent-1', submitted_at: '2026-07-03T08:00:00.000Z', score: 4 }),
      result({ id: 'persistent-2', submitted_at: '2026-07-08T08:00:00.000Z', score: 4 }),
      result({ id: 'persistent-3', submitted_at: '2026-07-13T08:00:00.000Z', score: 4 }),
      result({ id: 'persistent-4', submitted_at: '2026-07-18T08:00:00.000Z', score: 4 }),
      result({ id: 'persistent-5', submitted_at: '2026-07-23T08:00:00.000Z', score: 4 }),
    ]);
    expect(persistent.evidence).toEqual(expect.objectContaining({
      reason: 'PERSISTENT_WEAKNESS',
      averageSkillAccuracy: 0,
      recentAttemptCount: 5,
    }));
    expect(Number.isFinite(persistent.evidence.averageSkillAccuracy)).toBe(true);
    expect(Number.isFinite(persistent.evidence.minimumSkillAccuracy)).toBe(true);
  });});
