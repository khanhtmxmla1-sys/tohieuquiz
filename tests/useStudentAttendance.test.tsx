// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  fetchPetData: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  status: {
    claimedToday: false,
    claimDates: [] as string[],
    statusAvailable: true,
    enabled: true,
    available: true,
    questionCount: 4,
    attempt: null as any,
    rewardPreview: {
      attendanceDayNumber: 2,
      nextRewardExp: 10,
      nextRewardCoins: 5,
    },
    setClaimedToday: vi.fn(),
    setClaimDates: vi.fn(),
    setAttempt: vi.fn(),
  },
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ fetchPetData: mocks.fetchPetData }) },
}));
vi.mock('../src/utils/toast', () => ({
  showError: mocks.showError,
  showInfo: mocks.showInfo,
}));
vi.mock('../src/features/student-dashboard/hooks/useAttendanceStatus', () => ({
  useAttendanceStatus: () => mocks.status,
}));

import { useStudentAttendance } from '../src/features/student-dashboard/hooks/useStudentAttendance';

const item = (id: string, position: number, answered = false) => ({
  id,
  questionId: `q-${position}`,
  position,
  question: `Câu ${position}?`,
  options: ['1', '2', '3', '4'],
  selectedAnswer: answered ? 'B' : null,
  isAnswered: answered,
});

const attempt = (overrides: Record<string, unknown> = {}) => ({
  attemptId: 'attempt-1',
  status: 'IN_PROGRESS',
  completed: false,
  correctCount: 0,
  totalQuestions: 2,
  answeredCount: 0,
  items: [item('item-1', 1), item('item-2', 2)],
  ...overrides,
});

describe('useStudentAttendance two-question flow', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    mocks.fetchPetData.mockReset();
    mocks.showError.mockReset();
    mocks.showInfo.mockReset();
    mocks.status.claimedToday = false;
    mocks.status.statusAvailable = true;
    mocks.status.enabled = true;
    mocks.status.available = true;
    mocks.status.questionCount = 4;
    mocks.status.attempt = null;
    mocks.status.rewardPreview = {
      attendanceDayNumber: 2,
      nextRewardExp: 10,
      nextRewardCoins: 5,
    };
    mocks.status.setClaimedToday.mockReset();
    mocks.status.setClaimDates.mockReset();
    mocks.status.setAttempt.mockReset();
  });

  it('starts a server-owned attempt and sends the attempt item identity with the selected answer', async () => {
    mocks.callApi
      .mockResolvedValueOnce({ status: 'success', data: attempt() })
      .mockResolvedValueOnce({
        status: 'success',
        data: attempt({
          answeredCount: 1,
          items: [item('item-1', 1, true), item('item-2', 2)],
        }),
      });

    const { result } = renderHook(() => useStudentAttendance('student-a'));

    await act(async () => { await result.current.open(); });
    expect(mocks.callApi).toHaveBeenNthCalledWith(1, 'start_daily_attendance', {
      username: 'student-a',
    });
    expect(result.current.currentItem?.id).toBe('item-1');

    act(() => result.current.selectAnswer('B'));
    await act(async () => { await result.current.submit(); });

    expect(mocks.callApi).toHaveBeenNthCalledWith(2, 'answer_daily_attendance', {
      username: 'student-a',
      attemptId: 'attempt-1',
      itemId: 'item-1',
      selectedAnswer: 'B',
    });
    expect(result.current.currentItem?.id).toBe('item-2');
    expect(result.current.currentNumber).toBe(2);
  });

  it('marks attendance claimed and refreshes rewards after the second answer even if score is zero', async () => {
    mocks.callApi
      .mockResolvedValueOnce({
        status: 'success',
        data: attempt({
          answeredCount: 1,
          items: [item('item-1', 1, true), item('item-2', 2)],
        }),
      })
      .mockResolvedValueOnce({
        status: 'success',
        data: attempt({
          status: 'COMPLETED',
          completed: true,
          answeredCount: 2,
          correctCount: 0,
          awardedCoins: 5,
          awardedExp: 10,
          items: [item('item-1', 1, true), item('item-2', 2, true)],
        }),
      });

    const { result } = renderHook(() => useStudentAttendance('student-a'));
    await act(async () => { await result.current.open(); });
    expect(result.current.currentNumber).toBe(2);

    act(() => result.current.selectAnswer('A'));
    await act(async () => { await result.current.submit(); });

    expect(mocks.status.setClaimedToday).toHaveBeenCalledWith(true);
    expect(mocks.fetchPetData).toHaveBeenCalledWith('student-a');
    expect(result.current.completed).toBe(true);
    expect(result.current.attempt?.awardedCoins).toBe(5);
    expect(result.current.attempt?.awardedExp).toBe(10);
  });

  it('fails closed when the attendance status endpoint is unavailable or the teacher turned it off before starting', () => {
    mocks.status.statusAvailable = false;
    let rendered = renderHook(() => useStudentAttendance('student-a'));
    expect(rendered.result.current.isVisible).toBe(false);
    expect(rendered.result.current.isAvailable).toBe(false);
    rendered.unmount();

    mocks.status.statusAvailable = true;
    mocks.status.enabled = false;
    mocks.status.available = false;
    rendered = renderHook(() => useStudentAttendance('student-a'));
    expect(rendered.result.current.isVisible).toBe(false);
    expect(rendered.result.current.isAvailable).toBe(false);
  });

  it('keeps an in-progress attempt visible and resumable after the teacher turns attendance off', async () => {
    mocks.status.enabled = false;
    mocks.status.available = false;
    mocks.status.attempt = {
      attemptId: 'attempt-1',
      status: 'IN_PROGRESS',
      answeredCount: 1,
      correctCount: 0,
      totalQuestions: 2,
    };
    mocks.callApi.mockResolvedValueOnce({
      status: 'success',
      data: attempt({
        answeredCount: 1,
        items: [item('item-1', 1, true), item('item-2', 2)],
      }),
    });

    const { result } = renderHook(() => useStudentAttendance('student-a'));
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.badgeText).toBe('Tiếp tục điểm danh · còn 1 câu');

    await act(async () => { await result.current.open(); });
    expect(mocks.callApi).toHaveBeenCalledWith('start_daily_attendance', { username: 'student-a' });
    expect(result.current.currentItem?.id).toBe('item-2');
  });

  it('renders the fixed server-owned reward preview in the attendance label', () => {
    const { result } = renderHook(() => useStudentAttendance('student-a'));
    expect(result.current.badgeText).toBe('Điểm danh hôm nay · 2 câu · +5 Xu +10 EXP');
  });
});
