import { describe, expect, it } from 'vitest';
import {
  getAssignmentActionLabel,
  getAssignmentVisualState,
  getMissionProgressPercent,
  getWeeklyProgressPercent,
} from '../src/components/HomePage/student-dashboard/dashboard.utils';

const quiz = (attemptCount: number, maxAttempts: number, status: 'OPEN' | 'CLOSED') => ({
  id: 'quiz-1',
  title: 'Bài Toán',
  questions: [],
  timeLimit: 20,
  _assignmentData: {
    id: 'assignment-1',
    quizId: 'quiz-1',
    classId: 'class-1',
    deadline: '2099-01-01T00:00:00.000Z',
    maxAttempts,
    attemptCount,
    status,
    createdAt: '2026-07-18T00:00:00.000Z',
  },
} as any);

describe('student dashboard UI helpers', () => {
  it('maps assignment states without changing assignment rules', () => {
    expect(getAssignmentVisualState(quiz(0, 1, 'OPEN'))).toBe('ready');
    expect(getAssignmentVisualState(quiz(1, 1, 'OPEN'))).toBe('completed');
    expect(getAssignmentVisualState(quiz(0, 1, 'CLOSED'))).toBe('closed');
  });

  it('keeps completed precedence when an assignment is also closed', () => {
    expect(getAssignmentVisualState(quiz(1, 1, 'CLOSED'))).toBe('completed');
  });

  it('returns student-facing CTA labels', () => {
    expect(getAssignmentActionLabel('ready')).toBe('Làm bài ngay');
    expect(getAssignmentActionLabel('completed')).toBe('Xem kết quả');
    expect(getAssignmentActionLabel('closed')).toBe('Đã đóng');
  });

  it('clamps progress values', () => {
    expect(getMissionProgressPercent({ target: 10, progress: 12 } as any)).toBe(100);
    expect(getMissionProgressPercent({ target: 10, progress: -2 } as any)).toBe(0);
    expect(getWeeklyProgressPercent(2, 5)).toBe(40);
    expect(getWeeklyProgressPercent(1, 0)).toBe(0);
  });
});
