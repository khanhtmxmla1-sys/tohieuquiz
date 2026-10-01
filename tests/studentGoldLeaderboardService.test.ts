import { beforeEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/apiAdapter', () => ({
  callApi: callApiMock,
}));

import { getStudentLeaderboard } from '../src/services/gamificationService';
import { resolveApiRoute } from '../src/services/api/routeResolver';
import type { StudentLeaderboardData } from '../src/types/gamification.types';

const data: StudentLeaderboardData = {
  topStudents: [
    {
      studentId: 'student-1',
      fullName: 'Nguyễn An',
      avatar: 'girl_01',
      className: '5A',
      rank: 1,
      xu: 120,
    },
  ],
  currentStudent: {
    studentId: 'student-2',
    fullName: 'Trần Bình',
    avatar: null,
    className: '5A',
    rank: 2,
    xu: 100,
    gapToNext: 20,
  },
  totalStudents: 2,
  period: 'week',
  scope: 'school',
  updatedAt: '2026-09-30T08:00:00.000Z',
};

beforeEach(() => {
  callApiMock.mockReset();
});

describe('student gold leaderboard API contract', () => {
  it('registers the scoped student leaderboard route with encoded query parameters', () => {
    const route = resolveApiRoute('get_student_leaderboard');

    expect(route).toMatchObject({ method: 'GET', auth: 'session' });
    expect(route.path({})).toBe('/api/leaderboard/student');
    expect(route.query?.({ scope: 'class', period: 'all' }).toString())
      .toBe('scope=class&period=all');
  });

  it('loads and unwraps the typed leaderboard response for the requested view', async () => {
    callApiMock.mockResolvedValue({ status: 'success', data });

    await expect(getStudentLeaderboard({ scope: 'school', period: 'week' })).resolves.toEqual(data);
    expect(callApiMock).toHaveBeenCalledWith('get_student_leaderboard', {
      scope: 'school',
      period: 'week',
    });
  });

  it('surfaces a failed leaderboard request so the dialog can offer retry', async () => {
    callApiMock.mockRejectedValue(new Error('Bảng vàng tạm thời không khả dụng.'));

    await expect(getStudentLeaderboard({ scope: 'school', period: 'week' }))
      .rejects.toThrow('Bảng vàng tạm thời không khả dụng.');
  });
});
