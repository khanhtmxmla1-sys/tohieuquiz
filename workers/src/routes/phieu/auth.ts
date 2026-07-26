import type { PhieuScopeUser } from './types';

export function canAccessTeacherScope(
  user: PhieuScopeUser,
  teacherUsername: unknown,
): boolean {
  return user.role === 'admin' || String(teacherUsername || '') === user.username;
}
