import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizStore } from '../stores/quizStore';

const pollingQueryMock = vi.hoisted(() => vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
  refetch: vi.fn(async () => undefined),
})));
const legacyStatusHookMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('student controller must not use the fixed-interval status hook');
}));

vi.mock('../src/features/live-exam/hooks/usePollingQuery', () => ({
  usePollingQuery: pollingQueryMock,
}));
vi.mock('../src/hooks/useLiveExamStatus', () => ({
  useLiveExamStatus: legacyStatusHookMock,
}));
vi.mock('../src/features/student-dashboard/hooks/useLiveExamQuizPreparation', () => ({
  useLiveExamQuizPreparation: () => ({ isPreparing: false, loadError: null }),
}));

import { useStudentLiveExam } from '../src/features/student-dashboard/hooks/useStudentLiveExam';

const storedExam = {
  sessionId: 'session-jitter',
  sessionTitle: 'Thi trực tiếp',
  quizId: 'quiz-jitter',
  duration: 30,
};

describe('student Live Exam status polling', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useQuizStore.setState({ quizzes: [] });
    pollingQueryMock.mockClear();
    legacyStatusHookMock.mockClear();
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    sessionStorage.setItem(
      'tohieuquiz_live_exam_v1:session-jitter',
      JSON.stringify(storedExam),
    );
  });

  it('adds a stable per-session jitter instead of the shared fixed 3s polling cadence', () => {
    renderHook(() => useStudentLiveExam({ initialSessionId: 'session-jitter' }));

    expect(legacyStatusHookMock).not.toHaveBeenCalled();
    expect(pollingQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      intervalMs: 3_200,
    }));
  });
});
