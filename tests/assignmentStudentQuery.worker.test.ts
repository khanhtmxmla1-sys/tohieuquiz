import { describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  isStudent: vi.fn(() => true),
  requireAdmin: vi.fn(() => false),
  requireTeacher: vi.fn(() => false),
}));

import { getStudentAssignmentsResponse } from '../workers/src/classroom/assignmentStudentQuery';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: FakeDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql) as T; }
  async all<T>() { return { results: this.db.all(this.sql) as T[] }; }
}

class FakeDatabase {
  queries: string[] = [];
  prepare(sql: string) { this.queries.push(sql); return new Statement(sql, this); }
  first(sql: string) {
    if (sql.includes('FROM students')) {
      return { id: 'student-1', username: 'student-1', full_name: 'Nguyen Van A', class_id: 'class-4a9' };
    }
    return null;
  }
  all(sql: string) {
    if (sql.includes('FROM assignments')) {
      return [
        { id: 'assignment-new', quiz_id: 'quiz-1', class_id: 'class-4a9', student_id: '', deadline: '2099-01-01T00:00:00.000Z', max_attempts: 3, status: 'OPEN', created_at: '2026-07-02T00:00:00.000Z' },
        { id: 'assignment-old', quiz_id: 'quiz-1', class_id: 'class-4a9', student_id: '', deadline: '2026-07-01T00:00:00.000Z', max_attempts: 1, status: 'CLOSED', created_at: '2026-07-01T00:00:00.000Z' },
      ];
    }
    if (sql.includes('FROM results')) return [{ assignment_id: 'assignment-new', cnt: 1 }];
    return [];
  }
}

describe('student assignment attempt counts', () => {
  it('counts attempts independently for each assignment, even when quiz ids match', async () => {
    const db = new FakeDatabase();
    const response = await getStudentAssignmentsResponse(
      db as any,
      { id: 'student-1', username: 'student-1', role: 'student', classId: 'class-4a9' } as any,
      'student-1',
    );
    const payload = await response.json() as any;

    expect(payload.data).toEqual([
      expect.objectContaining({ id: 'assignment-new', attemptCount: 1 }),
      expect.objectContaining({ id: 'assignment-old', attemptCount: 0 }),
    ]);
    const countQuery = db.queries.find(sql => sql.includes('FROM results')) || '';
    expect(countQuery).toContain('assignment_id IN');
    expect(countQuery).toContain('GROUP BY assignment_id');
  });
});
