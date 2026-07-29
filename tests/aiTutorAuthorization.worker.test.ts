import { describe, expect, it, vi } from 'vitest';
import { loadAuthorizedAiTutorResult } from '../workers/src/services/aiTutorAuthorization';

const row = {
  id: 'result-1',
  student_id: 'student-1',
  assignment_id: 'assignment-1',
  quiz_id: 'quiz-1',
  class_name: '5A',
  answers: '[]',
};

function dbReturning(result: unknown) {
  const first = vi.fn().mockResolvedValue(result);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare, first, bind };
}

describe('AI Tutor ownership', () => {
  it('allows a student to load only their own result', async () => {
    const db = dbReturning(row);
    const result = await loadAuthorizedAiTutorResult(db as never, { username: 'student-user', role: 'student' }, 'result-1');
    expect(result?.id).toBe('result-1');
    expect(db.prepare).toHaveBeenCalled();
  });

  it('returns null for cross-owner access instead of exposing authorization detail', async () => {
    const db = dbReturning(null);
    await expect(loadAuthorizedAiTutorResult(db as never, { username: 'teacher-a', role: 'teacher' }, 'result-2')).resolves.toBeNull();
  });

  it('allows administrators to access an existing result', async () => {
    const db = dbReturning(row);
    await expect(loadAuthorizedAiTutorResult(db as never, { username: 'admin-a', role: 'admin' }, 'result-1')).resolves.toMatchObject({ id: 'result-1' });
  });
});
