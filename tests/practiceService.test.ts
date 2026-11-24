import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '../src/services/apiAdapter';
import { practiceService } from '../src/services/practiceService';
import { buildQuestionAnswerReview } from '../src/domain/quiz-scoring';

vi.mock('../src/services/apiAdapter', () => ({
  callApi: vi.fn(),
}));

const callApiMock = vi.mocked(callApi);

const validMcqReview = {
  questionId: 'q1', type: 'MCQ', status: 'correct', isCorrect: true,
  studentAnswer: { kind: 'text', lines: [{ value: 'A' }] },
  correctAnswer: { kind: 'text', lines: [{ value: 'A' }] },
  presentation: {
    schemaVersion: 1, source: 'submission', type: 'MCQ',
    items: [{ id: 'option-0', index: 0, state: 'correct', text: 'A', selected: true, correct: true }],
  },
};

const validGradeResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 'success', practiceId: 'practice-1', score: 10, correctCount: 1,
  questionCount: 1, totalQuestions: 1, voidedCount: 0, gradingVersion: 'server-v1',
  answers: { q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct' } },
  validationDetails: [{ questionId: 'q1', type: 'MCQ', isCorrect: true, status: 'correct' }],
  reviewDetails: [validMcqReview],
  ...overrides,
});

describe('practiceService', () => {
  beforeEach(() => {
    callApiMock.mockReset();
  });

  it('returns topic data from the practice API', async () => {
    callApiMock.mockResolvedValueOnce({ topics: [{ name: '#toan', count: 5 }] });

    await expect(practiceService.getTopics()).resolves.toEqual([
      { name: '#toan', count: 5 },
    ]);
  });

  it('rejects topic API failures instead of converting them to empty data', async () => {
    callApiMock.mockRejectedValueOnce(new Error('network down'));

    await expect(practiceService.getTopics()).rejects.toThrow('network down');
  });

  it('requests the negotiated secure delivery and adapts its question DTOs', async () => {
    callApiMock.mockResolvedValueOnce({
      id: 'practice-1',
      title: 'Secure practice',
      classLevel: '5',
      timeLimit: 0,
      createdAt: '2026-11-22T00:00:00.000Z',
      isPractice: true,
      practiceSession: {
        version: 'server-v1',
        token: 'session-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      questions: [{
        id: 'q1', type: 'MCQ', question: 'Chọn A', options: ['A', 'B'],
      }],
    });

    const quiz = await practiceService.getPracticeQuiz('toán', 10);

    expect(callApiMock).toHaveBeenCalledWith('get_practice_quiz', {
      topic: 'toán', limit: 10, delivery: 'server-v1',
    });
    expect(quiz?.practiceSession).toEqual({
      version: 'server-v1', token: 'session-token', expiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(quiz?.questions[0]).not.toHaveProperty('correctAnswer');
    expect(quiz?.questions[0]).toMatchObject({ id: 'q1', type: 'MCQ', options: ['A', 'B'] });
  });

  it.each([
    null,
    undefined,
    {},
    { version: 'legacy', token: 'token', expiresAt: '2099-01-01T00:00:00.000Z' },
    { version: 'server-v1', token: '', expiresAt: '2099-01-01T00:00:00.000Z' },
    { version: 'server-v1', token: 'token', expiresAt: 'not-a-date' },
  ])('rejects malformed secure practice session envelope %j without legacy fallback', async (practiceSession) => {
    callApiMock.mockResolvedValueOnce({
      id: 'practice-1', title: 'Malformed secure practice', classLevel: '5', timeLimit: 0,
      createdAt: '2026-11-22T00:00:00.000Z', isPractice: true, practiceSession,
      questions: [{ id: 'q1', type: 'MCQ', question: 'Q', options: ['A'], correctAnswer: 'A' }],
    });

    await expect(practiceService.getPracticeQuiz('toán', 10)).resolves.toBeNull();
  });

  it('fails closed for a secure shell that is not explicitly a practice quiz', async () => {
    callApiMock.mockResolvedValueOnce({
      id: 'practice-1', title: 'Poisoned secure practice', classLevel: '5', timeLimit: 0,
      isPractice: false,
      _assignmentData: { id: 'assignment-should-not-route' },
      practiceSession: {
        version: 'server-v1', token: 'session-token', expiresAt: '2099-01-01T00:00:00.000Z',
      },
      questions: [{ id: 'q1', type: 'MCQ', question: 'Q', options: ['A', 'B'] }],
    });

    await expect(practiceService.getPracticeQuiz('toán', 10)).resolves.toBeNull();
  });

  it('allowlists secure quiz shell fields and drops assignment/auth metadata', async () => {
    callApiMock.mockResolvedValueOnce({
      id: 'practice-1', title: 'Safe secure practice', classLevel: '5', timeLimit: 0,
      isPractice: true, createdAt: '2026-11-22T00:00:00.000Z', category: 'Luyện tập',
      requireCode: true, accessCode: 'secret',
      _assignmentData: { id: 'assignment-should-not-route' },
      practiceSession: {
        version: 'server-v1', token: 'session-token', expiresAt: '2099-01-01T00:00:00.000Z',
      },
      questions: [{ id: 'q1', type: 'MCQ', question: 'Q', options: ['A', 'B'] }],
    });

    const quiz = await practiceService.getPracticeQuiz('toán', 10);

    expect(quiz).toMatchObject({ id: 'practice-1', isPractice: true, timeLimit: 0 });
    expect(quiz).not.toHaveProperty('_assignmentData');
    expect(quiz).not.toHaveProperty('requireCode');
    expect(quiz).not.toHaveProperty('accessCode');
  });

  it('posts only the session token, raw answers and exact question order', async () => {
    const response = validGradeResponse();
    callApiMock.mockResolvedValueOnce(response);

    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token',
      answers: { q1: 'A' },
      questionOrder: ['q1'],
    }, 'practice-1')).resolves.toEqual(response);

    expect(callApiMock).toHaveBeenCalledWith('grade_practice_quiz', {
      sessionToken: 'session-token', answers: { q1: 'A' }, questionOrder: ['q1'],
    });
  });

  it('allows an empty or partial raw answer map for untouched questions', async () => {
    const response = validGradeResponse({
      questionCount: 2,
      totalQuestions: 2,
      correctCount: 1,
      score: 5,
      answers: {
        q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct' },
        q2: { selectedAnswer: null, isCorrect: false, status: 'skipped' },
      },
      validationDetails: [
        { questionId: 'q1', type: 'MCQ', isCorrect: true, status: 'correct' },
        { questionId: 'q2', type: 'MCQ', isCorrect: false, status: 'skipped' },
      ],
      reviewDetails: [
        validMcqReview,
        {
          ...validMcqReview,
          questionId: 'q2',
          status: 'skipped',
          isCorrect: false,
          studentAnswer: { kind: 'empty', lines: [{ value: 'Chưa trả lời' }] },
          presentation: {
            ...validMcqReview.presentation,
            items: [{ id: 'option-0', index: 0, state: 'skipped', text: 'A', selected: false, correct: true }],
          },
        },
      ],
    });
    callApiMock.mockResolvedValueOnce(response);

    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: {}, questionOrder: ['q1', 'q2'],
    }, 'practice-1')).resolves.toMatchObject({ questionCount: 2, score: 5 });
    expect(callApiMock).toHaveBeenCalledWith('grade_practice_quiz', {
      sessionToken: 'session-token', answers: {}, questionOrder: ['q1', 'q2'],
    });
  });

  it.each([
    ['score as text', { score: '10' }],
    ['non-finite counter', { correctCount: Number.NaN }],
    ['fractional counter', { questionCount: 1.5 }],
  ])('rejects authoritative response with %s', async (_label, overrides) => {
    callApiMock.mockResolvedValueOnce(validGradeResponse(overrides));
    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: { q1: 'A' }, questionOrder: ['q1'],
    }, 'practice-1')).rejects.toThrow(/authoritative|counter/i);
  });

  it.each([
    ['missing line value', {
      lines: [{ label: 'Em chọn' }],
    }],
    ['wrong choice item shape', {
      presentation: {
        ...validMcqReview.presentation,
        items: [{ id: 'option-0', index: 0, state: 'correct', selected: true, correct: true }],
      },
    }],
    ['duplicate presentation ids', {
      presentation: {
        ...validMcqReview.presentation,
        items: [
          { id: 'option-0', index: 0, state: 'correct', text: 'A', selected: true, correct: true },
          { id: 'option-0', index: 1, state: 'unknown', text: 'B', selected: false, correct: false },
        ],
      },
    }],
  ])('rejects malformed nested review: %s', async (_label, change) => {
    const review = {
      ...validMcqReview,
      ...(change.presentation ? { presentation: change.presentation } : {}),
      ...(change.lines ? { studentAnswer: { kind: 'text', lines: change.lines } } : {}),
    };
    callApiMock.mockResolvedValueOnce(validGradeResponse({ reviewDetails: [review] }));
    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: { q1: 'A' }, questionOrder: ['q1'],
    }, 'practice-1')).rejects.toThrow(/authoritative|review/i);
  });

  it('accepts a canonical builder review with 257 underline items', async () => {
    const words = Array.from({ length: 257 }, (_, index) => `từ-${index}`);
    const review = buildQuestionAnswerReview(
      {
        id: 'q1', type: 'UNDERLINE', question: 'Đọc câu', sentence: words.join(' '),
        words, correctWordIndexes: [0],
      },
      undefined,
      { questionId: 'q1', type: 'UNDERLINE', status: 'skipped', isCorrect: false },
      { source: 'submission' },
    );
    callApiMock.mockResolvedValueOnce(validGradeResponse({
      score: 0,
      correctCount: 0,
      answers: { q1: { selectedAnswer: null, isCorrect: false, status: 'skipped' } },
      validationDetails: [{ questionId: 'q1', type: 'UNDERLINE', isCorrect: false, status: 'skipped' }],
      reviewDetails: [review],
    }));

    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: {}, questionOrder: ['q1'],
    }, 'practice-1')).resolves.toMatchObject({ score: 0 });
  });

  it('rejects extra answer IDs and metadata before making a grading request', async () => {
    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: { q1: 'A', q2: 'unexpected' }, questionOrder: ['q1'],
    }, 'practice-1')).rejects.toThrow(/coverage/i);
    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: { _questionOrder: ['q1'] }, questionOrder: ['q1'],
    }, 'practice-1')).rejects.toThrow(/coverage/i);
    expect(callApiMock).not.toHaveBeenCalled();
  });

  it('rejects an authoritative response with incomplete exact-ID coverage', async () => {
    callApiMock.mockResolvedValueOnce({
      status: 'success', practiceId: 'practice-1', score: 10, correctCount: 1,
      questionCount: 2, totalQuestions: 2, voidedCount: 0, gradingVersion: 'server-v1',
      answers: { q1: { selectedAnswer: 'A' } },
      validationDetails: [{ questionId: 'q1', isCorrect: true, status: 'correct' }],
      reviewDetails: [{ questionId: 'q1', status: 'correct' }],
    });

    await expect(practiceService.gradePracticeQuiz({
      sessionToken: 'session-token', answers: { q1: 'A', q2: 'B' },
      questionOrder: ['q1', 'q2'],
    }, 'practice-1')).rejects.toThrow(/authoritative|coverage|question/i);
  });
});
