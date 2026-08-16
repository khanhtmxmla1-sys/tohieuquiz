// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  fetchPetData: vi.fn(),
  status: {
    claimedToday: false,
    claimDates: [] as string[],
    statusAvailable: true,
    rewardPreview: {
      attendanceDayNumber: 2,
      nextRewardExp: 50,
      nextRewardCoins: 50,
    },
    setClaimedToday: vi.fn(),
    setClaimDates: vi.fn(),
  },
  modal: {
    isOpen: true,
    question: {
      id: 'quiz-1-question-1',
      quizId: 'quiz-1',
      questionId: 'question-1',
      quizTitle: 'Toán',
      question: '1 + 1 = ?',
      options: ['A. 1', 'B. 2'],
      correctLabel: 'B',
    },
    selectedAnswer: 'B' as string | null,
    result: null as 'correct' | 'wrong' | 'info' | null,
    message: '',
    isSubmitting: false,
    hasQuestions: true,
    open: vi.fn(),
    close: vi.fn(),
    selectAnswer: vi.fn(),
    setResult: vi.fn(),
    setMessage: vi.fn(),
    setIsSubmitting: vi.fn(),
  },
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ fetchPetData: mocks.fetchPetData }) },
}));
vi.mock('../src/features/student-dashboard/hooks/useAttendanceStatus', () => ({
  useAttendanceStatus: () => mocks.status,
}));
vi.mock('../src/features/student-dashboard/hooks/useAttendanceModalState', () => ({
  useAttendanceModalState: () => mocks.modal,
}));

import { useStudentAttendance } from '../src/features/student-dashboard/hooks/useStudentAttendance';

const claimData = (overrides: Record<string, unknown> = {}) => ({
  claimed: true,
  alreadyClaimed: false,
  claimDates: ['2026-08-16'],
  streakDays: 1,
  attendanceDayNumber: 1,
  multiplier: 1,
  awardedExp: 50,
  awardedCoins: 50,
  ...overrides,
});

describe('useStudentAttendance integrity', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    mocks.fetchPetData.mockReset();
    mocks.status.claimedToday = false;
    mocks.status.claimDates = [];
    mocks.status.statusAvailable = true;
    mocks.status.rewardPreview = {
      attendanceDayNumber: 2,
      nextRewardExp: 50,
      nextRewardCoins: 50,
    };
    mocks.status.setClaimedToday.mockReset();
    mocks.status.setClaimDates.mockReset();
    mocks.modal.selectedAnswer = 'B';
    mocks.modal.result = null;
    mocks.modal.setResult.mockReset();
    mocks.modal.setMessage.mockReset();
    mocks.modal.setIsSubmitting.mockReset();
  });

  it('sends the canonical question identity and selected answer to the server', async () => {
    mocks.callApi.mockResolvedValueOnce({ status: 'success', data: claimData() });
    const { result } = renderHook(() => useStudentAttendance('student-a', []));

    await act(async () => { await result.current.submit(); });

    expect(mocks.callApi).toHaveBeenCalledWith('claim_daily_attendance', {
      username: 'student-a',
      quizId: 'quiz-1',
      questionId: 'question-1',
      selectedAnswer: 'B',
    });
  });

  it('fails closed when the attendance status endpoint is unavailable', () => {
    mocks.status.statusAvailable = false;
    const { result } = renderHook(() => useStudentAttendance('student-a', []));

    expect(result.current.isAvailable).toBe(false);
  });

  it('uses an informational result for an already-claimed response', async () => {
    mocks.callApi.mockResolvedValueOnce({
      status: 'success',
      data: claimData({ claimed: false, alreadyClaimed: true, message: 'Đã điểm danh.' }),
    });
    const { result } = renderHook(() => useStudentAttendance('student-a', []));

    await act(async () => { await result.current.submit(); });

    expect(mocks.status.setClaimedToday).toHaveBeenCalledWith(true);
    expect(mocks.modal.setResult).toHaveBeenCalledWith('info');
    expect(mocks.modal.setResult).not.toHaveBeenCalledWith('wrong');
  });

  it('renders the badge from the server-owned reward preview', () => {
    mocks.status.rewardPreview = {
      attendanceDayNumber: 6,
      nextRewardExp: 777,
      nextRewardCoins: 888,
    };
    const { result } = renderHook(() => useStudentAttendance('student-a', []));

    expect(result.current.badgeText).toBe('Điểm danh ngày 6: +888 Xu +777 EXP');
  });
});
