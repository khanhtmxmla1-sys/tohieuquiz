import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import { useQuestionEditor } from '../src/features/quiz-editor/hooks/useQuestionEditor';
import { showError } from '../src/utils/toast';

vi.mock('../src/utils/toast', () => ({
  showError: vi.fn(),
}));

const makeQuestion = () => ({
  id: 'q-math-1',
  type: QuestionType.MCQ,
  question: 'Tính giá trị biểu thức',
  options: ['1', '2'],
  correctAnswer: '1',
  difficulty: 1,
  explanation: '',
} as any);

const makeQuiz = (question: any) => ({
  id: 'quiz-math',
  title: 'Đề toán',
  classLevel: '4',
  timeLimit: 20,
  createdAt: new Date(0).toISOString(),
  questions: [question],
} as any);

describe('teacher question editor math validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks saving when a math delimiter or brace is incomplete', () => {
    const question = makeQuestion();
    const onUpdateQuestions = vi.fn();
    const { result } = renderHook(() => useQuestionEditor({
      quiz: makeQuiz(question),
      onUpdateQuestions,
    }));

    act(() => result.current.openEditor(question));
    act(() => result.current.setDraft((draft) => ({
      ...draft,
      question: 'Tính $\\frac{1}{2',
    } as any)));
    act(() => result.current.saveEdit());

    expect(onUpdateQuestions).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining('LaTeX chưa hợp lệ'),
      6000,
    );
  });

  it('normalizes valid raw TeX across the draft before saving', () => {
    const question = makeQuestion();
    const onUpdateQuestions = vi.fn();
    const { result } = renderHook(() => useQuestionEditor({
      quiz: makeQuiz(question),
      onUpdateQuestions,
    }));

    act(() => result.current.openEditor(question));
    act(() => result.current.setDraft((draft) => ({
      ...draft,
      question: 'Tính \\frac{\\sqrt{2}}{2}',
      options: ['\\sqrt{2}', '2'],
    } as any)));
    act(() => result.current.saveEdit());

    expect(onUpdateQuestions).toHaveBeenCalledTimes(1);
    const saved = onUpdateQuestions.mock.calls[0][0][0];
    expect(saved.question).toBe('Tính $\\frac{\\sqrt{2}}{2}$');
    expect(saved.options[0]).toBe('$\\sqrt{2}$');
    expect(showError).not.toHaveBeenCalled();
  });
});