import { describe, expect, it } from 'vitest';
import { evaluateAiQuestionQuality } from '../shared/ai-question-quality';
import { inspectAiQuestionQuality } from '../workers/src/services/aiQuestionQuality';

const validMcq = (overrides: Record<string, unknown> = {}) => ({
  id: 'q-1',
  type: 'MCQ',
  question: 'Hai cộng hai bằng bao nhiêu?',
  options: ['1', '2', '3', '4'],
  correctAnswer: 'D',
  ...overrides,
});

describe('AI question quality gate', () => {
  it('accepts a valid MCQ and returns a deterministic summary shape', () => {
    const summary = evaluateAiQuestionQuality({
      classLevel: '4A',
      questions: [validMcq()],
      checkedAt: '2026-07-28T00:00:00.000Z',
    });

    expect(summary).toEqual({
      version: 'ai-question-quality-v1',
      checkedAt: '2026-07-28T00:00:00.000Z',
      questionCount: 1,
      blockingCount: 0,
      warningCount: 0,
      canPublish: true,
      issues: [],
    });
  });

  it('blocks an MCQ whose answer is outside the options', () => {
    const summary = evaluateAiQuestionQuality({
      classLevel: '4A',
      questions: [validMcq({ correctAnswer: 'E' })],
    });

    expect(summary.canPublish).toBe(false);
    expect(summary.blockingCount).toBe(1);
    expect(summary.issues[0]).toEqual(expect.objectContaining({
      code: 'ANSWER_OUTSIDE_OPTIONS',
      severity: 'blocking',
      questionIndex: 0,
      path: 'correctAnswer',
    }));
  });

  it('detects empty stems, duplicate questions and duplicate options', () => {
    const summary = evaluateAiQuestionQuality({
      classLevel: '4A',
      questions: [
        validMcq({ id: 'empty', question: '' }),
        validMcq({ id: 'duplicate-options', options: ['4', '4', '3', '2'], correctAnswer: 'A' }),
        validMcq({ id: 'original' }),
        validMcq({ id: 'duplicate' }),
      ],
    });

    expect(summary.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'EMPTY_STEM',
      'DUPLICATE_OPTION',
      'DUPLICATE_QUESTION',
    ]));
    expect(summary.blockingCount).toBeGreaterThanOrEqual(3);
  });

  it('raises acknowledgement warnings for explicit grade mismatch and math parse risk', () => {
    const summary = evaluateAiQuestionQuality({
      classLevel: '4A',
      questions: [validMcq({
        question: 'Bài toán lớp 5: tính $2 + 2.',
      })],
    });

    expect(summary.canPublish).toBe(true);
    expect(summary.blockingCount).toBe(0);
    expect(summary.warningCount).toBe(2);
    expect(summary.issues.map((issue) => issue.code)).toEqual([
      'GRADE_MISMATCH',
      'MATH_PARSE_RISK',
    ]);
  });

  it('uses the same evaluator in the Worker service', () => {
    const summary = inspectAiQuestionQuality({
      classLevel: '4A',
      questions: [validMcq({ correctAnswer: 'Không có trong lựa chọn' })],
      checkedAt: '2026-07-28T00:00:00.000Z',
    });

    expect(summary.version).toBe('ai-question-quality-v1');
    expect(summary.canPublish).toBe(false);
    expect(summary.issues[0].code).toBe('ANSWER_OUTSIDE_OPTIONS');
  });
});
