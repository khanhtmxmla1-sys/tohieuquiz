import { describe, expect, it } from 'vitest';
import { loadInterventionDashboard } from '../workers/src/services/interventionService';

const STARTED = '{"status":"STARTED"}';

interface QueryCall {
  query: string;
  bindings: unknown[];
}

function createDashboardDb() {
  const calls: QueryCall[] = [];
  const activeGroup = {
    id: 'group-active',
    teacher_username: 'teacher-a',
    name: 'Nhóm đang hỗ trợ',
    status: 'ACTIVE',
    class_id: 'class-a',
    class_name: '4A',
    subject: 'math',
    subject_label: 'Toán',
    skill_code: 'phan_so',
    skill_label: 'Phân số',
    sample_size: 3,
    confidence: 0.6,
    source_filter_json: '{}',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
  const archivedGroup = { ...activeGroup, id: 'group-archived', status: 'ARCHIVED', name: 'Nhóm đã kết thúc' };
  const completedResult = {
    id: 'result-1',
    student_id: 'student-a',
    class_id: 'class-a',
    student_name: 'Lan',
    class_name: '4A',
    quiz_id: 'quiz-a',
    quiz_title: 'Phân số',
    score: 4,
    correct_count: 0,
    total_questions: 1,
    time_taken: 60,
    submitted_at: '2026-08-05T08:00:00.000Z',
    answers: JSON.stringify({ q1: { selectedAnswer: 'B', isCorrect: false } }),
  };
  const question = {
    id: 'q1',
    quiz_id: 'quiz-a',
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
  };

  const db = {
    prepare(query: string) {
      return {
        bind(...bindings: unknown[]) {
          calls.push({ query, bindings });
          return {
            async all<T>() {
              if (query.includes('SELECT id, name FROM classes')) {
                return { results: [{ id: 'class-a', name: '4A' }] as T[] };
              }
              if (query.includes('FROM students s')) {
                return { results: [{ id: 'student-a', full_name: 'Lan', class_id: 'class-a', class_name: '4A' }] as T[] };
              }
              if (query.includes('FROM results r')) {
                const rows = [completedResult, { ...completedResult, id: 'started', answers: STARTED }]
                  .filter((row) => row.answers !== STARTED);
                return { results: rows as T[] };
              }
              if (query.includes('FROM questions WHERE quiz_id IN')) {
                return { results: [question] as T[] };
              }
              if (query.includes('FROM quizzes q')) {
                return { results: [] as T[] };
              }
              if (query.includes('FROM intervention_groups g')) {
                const rows = [activeGroup, archivedGroup].filter((group) => group.status === 'ACTIVE');
                return { results: rows as T[] };
              }
              if (query.includes('FROM intervention_group_members m')) {
                return { results: [] as T[] };
              }
              if (query.includes('FROM intervention_notes')) {
                return { results: [] as T[] };
              }
              throw new Error(`Unhandled query: ${query}`);
            },
          };
        },
        async all<T>() {
          calls.push({ query, bindings: [] });
          if (query.includes('FROM quizzes q')) return { results: [] as T[] };
          throw new Error(`Unhandled unbound query: ${query}`);
        },
      };
    },
  } as any;

  return { db, calls };
}

function createReadinessMatrixDb() {
  const students = [
    { id: 'eligible', full_name: 'An', class_id: 'class-a', class_name: '4A' },
    { id: 'low-confidence', full_name: 'Bình', class_id: 'class-a', class_name: '4A' },
    { id: 'stable', full_name: 'Chi', class_id: 'class-a', class_name: '4A' },
    { id: 'insufficient', full_name: 'Dũng', class_id: 'class-a', class_name: '4A' },
  ];
  const answerEntry = (isCorrect: boolean) => ({ selectedAnswer: isCorrect ? 'A' : 'B', isCorrect });
  const makeResult = (studentId: string, answers: Record<string, unknown>) => ({
    id: `result-${studentId}`,
    student_id: studentId,
    class_id: 'class-a',
    student_name: students.find((student) => student.id === studentId)?.full_name || studentId,
    class_name: '4A',
    quiz_id: 'quiz-a',
    quiz_title: 'Phân số',
    score: 4,
    correct_count: 0,
    total_questions: Object.keys(answers).length,
    time_taken: 60,
    submitted_at: '2026-08-05T08:00:00.000Z',
    answers: JSON.stringify(answers),
  });
  const results = [
    makeResult('eligible', { qe1: answerEntry(false), qe2: answerEntry(false), qe3: answerEntry(false) }),
    makeResult('low-confidence', { ql1: answerEntry(false), ql2: answerEntry(false), ql3: answerEntry(false), qmissing: answerEntry(false) }),
    makeResult('stable', { qs1: answerEntry(true), qs2: answerEntry(true), qs3: answerEntry(true) }),
    makeResult('insufficient', { qi1: answerEntry(false), qi2: answerEntry(false) }),
  ];
  const question = (id: string, hasMetadata = true) => ({
    id,
    quiz_id: 'quiz-a',
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
    subject: hasMetadata ? 'math' : '',
    skill_code: hasMetadata ? 'phan_so' : '',
    subskill_code: '',
  });
  const questions = [
    ...['qe1', 'qe2', 'qe3', 'ql1', 'ql2', 'ql3', 'qs1', 'qs2', 'qs3', 'qi1', 'qi2'].map((id) => question(id)),
    question('qmissing', false),
  ];

  return {
    prepare(query: string) {
      return {
        bind(..._bindings: unknown[]) {
          return {
            async all<T>() {
              if (query.includes('SELECT id, name FROM classes')) return { results: [{ id: 'class-a', name: '4A' }] as T[] };
              if (query.includes('FROM students s')) return { results: students as T[] };
              if (query.includes('FROM results r')) return { results: results as T[] };
              if (query.includes('FROM questions WHERE quiz_id IN')) return { results: questions as T[] };
              if (query.includes('FROM quizzes q')) return { results: [] as T[] };
              if (query.includes('FROM intervention_groups g')) return { results: [] as T[] };
              throw new Error(`Unhandled query: ${query}`);
            },
          };
        },
        async all<T>() {
          if (query.includes('FROM quizzes q')) return { results: [] as T[] };
          throw new Error(`Unhandled unbound query: ${query}`);
        },
      };
    },
  } as any;
}

function createNoScopeDb() {
  return {
    prepare(query: string) {
      return {
        bind() {
          return {
            async all<T>() {
              if (query.includes('SELECT id, name FROM classes')) return { results: [] as T[] };
              throw new Error(`Unexpected query after empty scope: ${query}`);
            },
          };
        },
      };
    },
  } as any;
}

describe('intervention dashboard worker service', () => {
  it('keeps the 28-day result window, excludes STARTED rows and scopes teacher queries to owned classes', async () => {
    const { db, calls } = createDashboardDb();
    const now = new Date('2026-08-11T08:00:00.000Z');

    await loadInterventionDashboard(db, { username: 'teacher-a', role: 'teacher' } as any, {}, now);

    const classCall = calls.find((call) => call.query.includes('SELECT id, name FROM classes'));
    expect(classCall?.query).toContain('teacher_username = ?');
    expect(classCall?.bindings).toContain('teacher-a');

    const resultCall = calls.find((call) => call.query.includes('FROM results r'));
    expect(resultCall?.query).toContain(`r.answers != '${STARTED}'`);
    expect(resultCall?.bindings[0]).toBe('2026-07-14T08:00:00.000Z');

    const groupCall = calls.find((call) => call.query.includes('FROM intervention_groups g'));
    expect(groupCall?.query).toContain("g.status = 'ACTIVE'");
    expect(groupCall?.query).toContain('g.teacher_username = ?');
    expect(groupCall?.bindings).toContain('teacher-a');
  });

  it('returns only active persisted groups', async () => {
    const { db } = createDashboardDb();
    const dashboard = await loadInterventionDashboard(
      db,
      { username: 'teacher-a', role: 'teacher' } as any,
      {},
      new Date('2026-08-11T08:00:00.000Z'),
    );

    expect(dashboard.groups.map((group) => group.id)).toEqual(['group-active']);
  });

  it('returns readiness counts for the current dashboard scope', async () => {
    const { db } = createDashboardDb();
    const dashboard = await loadInterventionDashboard(
      db,
      { username: 'teacher-a', role: 'teacher' } as any,
      {},
      new Date('2026-08-11T08:00:00.000Z'),
    );

    expect(dashboard).toMatchObject({
      readiness: {
        studentsInScope: 1,
        resultsInWindow: 1,
        quizzesInScope: 1,
        questionsInScope: 1,
        questionsWithSkillMetadata: 1,
        skillMetadataCoveragePercent: 100,
      },
    });
  });

  it('counts readiness exclusions with deterministic mutually-exclusive reasons', async () => {
    const dashboard = await loadInterventionDashboard(
      createReadinessMatrixDb(),
      { username: 'teacher-a', role: 'teacher' } as any,
      {},
      new Date('2026-08-11T08:00:00.000Z'),
    );

    expect(dashboard.readiness).toEqual({
      studentsInScope: 4,
      resultsInWindow: 4,
      quizzesInScope: 1,
      questionsInScope: 12,
      questionsWithSkillMetadata: 11,
      skillMetadataCoveragePercent: 92,
      studentSkillSignals: 4,
      eligibleSignals: 1,
      excludedSignals: {
        stable: 1,
        insufficientSamples: 1,
        lowConfidence: 1,
        missingMetadata: 1,
      },
    });
  });

  it('returns zero-valued readiness without extra queries when no class is in scope', async () => {
    const dashboard = await loadInterventionDashboard(
      createNoScopeDb(),
      { username: 'teacher-a', role: 'teacher' } as any,
      {},
      new Date('2026-08-11T08:00:00.000Z'),
    );

    expect(dashboard.readiness).toEqual({
      studentsInScope: 0,
      resultsInWindow: 0,
      quizzesInScope: 0,
      questionsInScope: 0,
      questionsWithSkillMetadata: 0,
      skillMetadataCoveragePercent: 0,
      studentSkillSignals: 0,
      eligibleSignals: 0,
      excludedSignals: {
        stable: 0,
        insufficientSamples: 0,
        lowConfidence: 0,
        missingMetadata: 0,
      },
    });
  });
});
