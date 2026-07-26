import type { GameLoopMission } from '../../../types';
import type { AssignedQuiz, AssignmentVisualState } from './dashboard.types';

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const isAssignmentClosed = (quiz: AssignedQuiz): boolean => {
  const assignment = quiz._assignmentData;
  if (!assignment) return false;
  if (assignment.status === 'CLOSED') return true;

  const deadline = Date.parse(assignment.deadline || '');
  return Number.isFinite(deadline) && deadline < Date.now();
};

export function getAssignmentVisualState(quiz: AssignedQuiz): AssignmentVisualState {
  const assignment = quiz._assignmentData;
  const attemptCount = Number(assignment?.attemptCount) || 0;
  const maxAttempts = Math.max(1, Number(assignment?.maxAttempts) || 1);

  if (assignment && attemptCount >= maxAttempts) return 'completed';
  if (isAssignmentClosed(quiz)) return 'closed';
  return 'ready';
}

export function getAssignmentActionLabel(state: AssignmentVisualState): string {
  if (state === 'completed') return 'Xem kết quả';
  if (state === 'closed') return 'Đã đóng';
  return 'Làm bài ngay';
}

export function getMissionProgressPercent(mission: GameLoopMission): number {
  const target = Number(mission.target);
  if (!Number.isFinite(target) || target <= 0) return 0;

  const progress = Number(mission.progress);
  if (!Number.isFinite(progress)) return 0;
  return clampPercent(Math.round((progress / target) * 100));
}

export function getWeeklyProgressPercent(completedDays: number, targetDays: number): number {
  const target = Number(targetDays);
  if (!Number.isFinite(target) || target <= 0) return 0;

  const completed = Number(completedDays);
  if (!Number.isFinite(completed)) return 0;
  return clampPercent(Math.round((completed / target) * 100));
}
