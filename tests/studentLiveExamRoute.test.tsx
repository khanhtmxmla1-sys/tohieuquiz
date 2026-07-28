import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentLiveExam } from '../src/features/student-dashboard/hooks/useStudentLiveExam';
import { useQuizStore } from '../stores/quizStore';

vi.mock('../src/hooks/useLiveExamStatus', () => ({
  useLiveExamStatus: () => ({ status: null }),
}));

vi.mock('../src/features/student-dashboard/hooks/useLiveExamQuizPreparation', () => ({
  useLiveExamQuizPreparation: () => ({ isPreparing: false, loadError: null }),
}));

const storedExam = {
  sessionId: 'session-1',
  sessionTitle: 'Thi Toán trực tiếp',
  quizId: 'quiz-1',
  duration: 30,
  startedAt: '2026-07-28T10:00:00.000Z',
};

describe('student live exam URL recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useQuizStore.setState({ quizzes: [] });
  });

  it('restores joined metadata from sessionStorage after a route refresh', () => {
    sessionStorage.setItem(
      'tohieuquiz_live_exam_v1:session-1',
      JSON.stringify(storedExam),
    );

    const { result } = renderHook(() => useStudentLiveExam({ initialSessionId: 'session-1' }));

    expect(result.current.joinedExam).toEqual(storedExam);
    expect(result.current.isJoinModalOpen).toBe(false);
  });

  it('persists a successful join and publishes the canonical session id', () => {
    const onJoined = vi.fn();
    const { result } = renderHook(() => useStudentLiveExam({ onJoined }));

    act(() => {
      result.current.join({
        id: 'session-2',
        title: 'Thi Tiếng Việt',
        quizId: 'quiz-2',
        duration: 20,
        status: 'waiting',
      });
    });

    expect(onJoined).toHaveBeenCalledWith('session-2');
    expect(JSON.parse(sessionStorage.getItem('tohieuquiz_live_exam_v1:session-2') || '{}'))
      .toMatchObject({ sessionId: 'session-2', quizId: 'quiz-2', duration: 20 });
  });

  it('requests the access code when a shared session URL has no local join metadata', async () => {
    const onUnrestoredClose = vi.fn();
    const { result } = renderHook(() => useStudentLiveExam({
      initialSessionId: 'session-missing',
      onUnrestoredClose,
    }));

    await waitFor(() => expect(result.current.isJoinModalOpen).toBe(true));
    act(() => result.current.closeJoinModal());
    expect(onUnrestoredClose).toHaveBeenCalledTimes(1);
  });
});
