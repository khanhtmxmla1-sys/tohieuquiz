import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useQuizManager } from '../src/hooks/useQuizManager';

const makeQuiz = (index: number, tags: unknown = []) => ({
  id: `quiz-${index}`,
  title: `Đề số ${index}`,
  classLevel: '4',
  category: 'math',
  tags,
  questions: [],
  timeLimit: 20,
  createdAt: `2026-07-${String(index).padStart(2, '0')}T00:00:00.000Z`,
}) as any;

describe('useQuizManager', () => {
  it('returns to page one whenever search or filters change', async () => {
    const quizzes = Array.from({ length: 15 }, (_, index) => makeQuiz(index + 1));
    const { result } = renderHook(() => useQuizManager({ quizzes, onDelete: vi.fn() }));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setSearchTerm('Đề số 1'));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.paginatedQuizzes.length).toBeGreaterThan(0);
  });

  it('treats malformed serialized tags as an empty list', () => {
    const { result } = renderHook(() => useQuizManager({
      quizzes: [makeQuiz(1, '{not-json')],
      onDelete: vi.fn(),
    }));

    act(() => result.current.setSearchTerm('#toán'));
    expect(result.current.filteredQuizzes).toEqual([]);
  });
});
