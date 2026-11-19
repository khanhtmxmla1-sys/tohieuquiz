import { beforeEach, describe, expect, it, vi } from 'vitest';
const callApi = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import {
  adaptStudentQuizQuestion,
  fetchQuizPlayQuestions,
  requestQuizAccess,
  verifyQuizAccessCode,
} from '../src/services/quizAccessService';

describe('quizAccessService', () => {
  beforeEach(() => callApi.mockReset());

  it('normalizes the code and uses the public verification action', async () => {
    callApi.mockResolvedValue({ valid: true });
    await expect(verifyQuizAccessCode('quiz-1', ' abc123 ')).resolves.toBe(true);
    expect(callApi).toHaveBeenCalledWith('verify_quiz_access_code', {
      quizId: 'quiz-1',
      accessCode: 'ABC123',
    });
  });

  it('returns the short-lived grant without reducing it to a boolean', async () => {
    callApi.mockResolvedValue({
      valid: true,
      accessGrant: 'grant.student.quiz-1',
      expiresAt: '2026-11-19T01:00:00.000Z',
      revision: 3,
    });

    await expect(requestQuizAccess('quiz-1', ' abc123 ', 'assignment-7')).resolves.toEqual({
      valid: true,
      accessGrant: 'grant.student.quiz-1',
      expiresAt: '2026-11-19T01:00:00.000Z',
      revision: 3,
    });
    expect(callApi).toHaveBeenCalledWith('verify_quiz_access_code', {
      quizId: 'quiz-1',
      accessCode: 'ABC123',
      assignmentId: 'assignment-7',
    });
  });

  it('loads learner questions through the scoped play contract', async () => {
    callApi.mockResolvedValue({ quizId: 'quiz-1', revision: 3, questions: [{ id: 'q1', type: 'MCQ' }] });

    await expect(fetchQuizPlayQuestions('quiz-1', {
      assignmentId: 'assignment-7',
      accessGrant: 'grant.student.quiz-1',
    })).resolves.toEqual({
      quizId: 'quiz-1',
      revision: 3,
      questions: [{ id: 'q1', type: 'MCQ' }],
    });
    expect(callApi).toHaveBeenCalledWith('get_quiz_play_questions', {
      quizId: 'quiz-1',
      assignmentId: 'assignment-7',
      accessGrant: 'grant.student.quiz-1',
    });
  });

  it('loads a public quiz without inventing an access grant', async () => {
    callApi.mockResolvedValue({ quizId: 'public-quiz', revision: 1, questions: [] });

    await fetchQuizPlayQuestions('public-quiz');

    expect(callApi).toHaveBeenCalledWith('get_quiz_play_questions', {
      quizId: 'public-quiz',
    });
  });

  it('maps a generic 403 to an invalid code result', async () => {
    callApi.mockImplementationOnce(() => Promise.reject({
      status: 403,
      code: 'INVALID_ACCESS_CODE',
      message: 'Forbidden',
    }));
    await expect(verifyQuizAccessCode('quiz-1', 'ABC123')).resolves.toBe(false);
  });

  it('rethrows network and server failures', async () => {
    callApi.mockImplementationOnce(() => Promise.reject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Offline',
    }));
    await expect(verifyQuizAccessCode('quiz-1', 'ABC123')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('preserves underline words, punctuation and line breaks from the learner DTO', () => {
    const question = adaptStudentQuizQuestion({
      id: 'underline-1',
      type: 'UNDERLINE',
      question: 'Chọn từ đúng',
      sentence: '“đỏ,”\nđỏ.',
      words: ['“đỏ,”', 'đỏ.'],
    });

    expect(question).toMatchObject({
      id: 'underline-1',
      type: 'UNDERLINE',
      sentence: '“đỏ,”\nđỏ.',
      words: ['“đỏ,”', 'đỏ.'],
    });
    expect(question).not.toHaveProperty('items');
    expect(question).not.toHaveProperty('correctWordIndexes');
  });

  it('keeps opaque matching and drag-drop IDs unchanged', () => {
    const matching = adaptStudentQuizQuestion({
      id: 'matching-1',
      type: 'MATCHING',
      question: 'Nối',
      leftItems: [{ id: 'sq1_left_opaque', content: 'A' }],
      rightItems: [{ id: 'sq1_right_opaque', content: '1' }],
    });
    const dragDrop = adaptStudentQuizQuestion({
      id: 'drag-1',
      type: 'DRAG_DROP',
      question: 'Điền',
      text: 'Chọn [1].',
      blanks: [{ id: 'sq1_blank_opaque' }],
      answerPool: ['X', 'Y'],
    });

    expect((matching as any).leftItems[0].id).toBe('sq1_left_opaque');
    expect((matching as any).rightItems[0].id).toBe('sq1_right_opaque');
    expect((dragDrop as any).blanks[0].id).toBe('sq1_blank_opaque');
    expect((dragDrop as any).answerPool).toEqual(['X', 'Y']);
  });
});
