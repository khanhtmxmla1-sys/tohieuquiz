import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useQuizFormState } from '../src/features/quiz-generator/hooks/useQuizFormState';
import type { Quiz } from '../src/types';

const options = {
  editingQuiz: null as Quiz | null,
  isClassLocked: false,
  lockedClass: '',
  teacherName: 'Giáo viên',
};

describe('useQuizFormState SVG lifecycle', () => {
  it('defaults off and resetAfterSave restores off', () => {
    const { result } = renderHook(() => useQuizFormState(options));
    expect(result.current.autoGenerateSvg).toBe(false);
    act(() => result.current.setAutoGenerateSvg(true));
    expect(result.current.questionBlueprintV3?.slots.every(
      (slot) => slot.diagramPolicy === 'optional',
    )).toBe(true);
    act(() => result.current.resetAfterSave());
    expect(result.current.autoGenerateSvg).toBe(false);
    expect(result.current.questionBlueprintV3?.slots.every(
      (slot) => slot.diagramPolicy === 'forbidden',
    )).toBe(true);
  });

  it('does not lose the preference when the teacher class lock resolves asynchronously', () => {
    const { result, rerender } = renderHook(
      ({ isClassLocked, lockedClass }) => useQuizFormState({
        ...options,
        isClassLocked,
        lockedClass,
      }),
      { initialProps: { isClassLocked: false, lockedClass: '' } },
    );
    act(() => result.current.setAutoGenerateSvg(true));
    rerender({ isClassLocked: true, lockedClass: '4A' });
    expect(result.current.autoGenerateSvg).toBe(true);
  });

  it('does not infer the generation preference from an edited quiz', () => {
    const editedQuiz = {
      id: 'quiz-old',
      title: 'Đề cũ có SVG',
      classLevel: '4',
      category: 'toan',
      timeLimit: 30,
      questions: [{
        id: 'q1',
        type: 'MCQ',
        question: 'Quan sát hình',
        options: ['A', 'B'],
        correctAnswer: 'A',
        svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" /></svg>',
        svgAlt: 'Một đường tròn',
        svgVersion: 1,
      }],
      isPractice: true,
    } as Quiz;
    const { result } = renderHook(() => useQuizFormState({ ...options, editingQuiz: editedQuiz }));
    expect(result.current.autoGenerateSvg).toBe(false);
  });
});
