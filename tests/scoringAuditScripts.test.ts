// @vitest-environment node
import { describe, expect, it } from 'vitest';

const support = require('../workers/scripts/scoring-report-support.cjs');
const audit = require('../workers/scripts/audit-scoring-contracts.cjs');
const regrade = require('../workers/scripts/report-result-regrading.cjs');

const questionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'q1', quiz_id: 'quiz-a', type: 'MCQ', question: '2 + 2?', options: '4|5',
  correct_answer: 'A', items: '', text_field: '', blanks: '', distractors: '',
  sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
  answer_schema_version: 1,
  ...overrides,
});

describe('read-only scoring audit scripts', () => {
  it('loads the same canonical runtime used by production', () => {
    const runtime = support.loadScoringRuntime();
    const result = runtime.gradeQuestion({
      id: 'q', type: 'DROPDOWN', text: '[blank_0]',
      blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }],
    }, { 0: 'x' });
    expect(result).toMatchObject({ status: 'correct', isCorrect: true });
  });

  it('rejects mutating SQL and unsafe target options', () => {
    expect(() => support.normalizeReadOnlyOptions({ local: true })).toThrow(/persist-to/);
    expect(() => support.normalizeReadOnlyOptions({ remote: true, database: 'db' })).toThrow(/confirm-remote db/);
    expect(() => support.normalizeReadOnlyOptions({ local: true, persistTo: 'tmp', write: true })).toThrow(/read-only/);
    expect(() => support.queryD1({ mode: 'local', persistTo: 'tmp' }, 'UPDATE results SET score = 0'))
      .toThrow(/Only SELECT|forbidden/);
  });

  it('reports malformed and unsupported question contracts without answer text', () => {
    const report = audit.auditQuestionRows([
      questionRow(),
      questionRow({ id: 'bad-json', options: '[invalid' }),
      questionRow({ id: 'geometry', type: 'GEOMETRY', options: '', correct_answer: '' }),
    ]);

    expect(report.summary).toMatchObject({ questions: 3, blockers: 3 });
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'bad-json', code: 'INVALID_CHOICE_CONTRACT' }),
      expect.objectContaining({ questionId: 'geometry', code: 'QUESTION_NOT_AUTO_GRADABLE' }),
    ]));
    expect(JSON.stringify(report)).not.toContain('2 + 2?');
  });

  it('computes historical deltas without producing update instructions or PII', () => {
    const report = regrade.buildHistoricalRegradeReport([
      {
        id: 1, quiz_id: 'quiz-a', score: 10, correct_count: 1, total_questions: 1,
        answers: JSON.stringify({ q1: { selectedAnswer: 'B', isCorrect: true } }),
        grading_version: 'legacy',
      },
      {
        id: 2, quiz_id: 'missing', score: 5, correct_count: 1, total_questions: 2,
        answers: '{}', grading_version: 'legacy',
      },
    ], [questionRow()]);

    expect(report).toMatchObject({
      readOnly: true,
      summary: { results: 2, regradable: 1, affected: 1, unregradable: 1 },
      affected: [expect.objectContaining({ resultId: '1', oldScore: 10, newScore: 0, scoreDelta: -10 })],
      issues: [expect.objectContaining({ resultId: '2', status: 'UNREGRADABLE' })],
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/UPDATE|INSERT|DELETE/);
    expect(serialized).not.toMatch(/studentName|student_name|full_name/);
  });
});
