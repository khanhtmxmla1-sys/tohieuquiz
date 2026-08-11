// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canAccessCanonicalResult,
  resultScopePredicate,
  type ResultAccessScope,
} from '../workers/src/services/resultAccess';

const admin: ResultAccessScope = { role: 'admin', studentId: null, classIds: [] };
const teacher: ResultAccessScope = { role: 'teacher', studentId: null, classIds: ['class-a'] };
const student: ResultAccessScope = { role: 'student', studentId: 'student-a', classIds: ['class-a'] };

describe('canonical result access scope', () => {
  it('lets admin access unresolved legacy rows but fails closed for teachers and students', () => {
    const unresolved = { student_id: null, class_id: null };
    expect(canAccessCanonicalResult(admin, unresolved)).toBe(true);
    expect(canAccessCanonicalResult(teacher, unresolved)).toBe(false);
    expect(canAccessCanonicalResult(student, unresolved)).toBe(false);
  });

  it('authorizes students only by student_id and teachers only by class_id', () => {
    const sameNamesWrongIds = {
      student_id: 'student-b',
      class_id: 'class-b',
      student_name: 'An',
      class_name: '4A',
    };
    expect(canAccessCanonicalResult(student, sameNamesWrongIds)).toBe(false);
    expect(canAccessCanonicalResult(teacher, sameNamesWrongIds)).toBe(false);

    expect(canAccessCanonicalResult(student, { student_id: 'student-a', class_id: 'class-b' })).toBe(true);
    expect(canAccessCanonicalResult(teacher, { student_id: 'student-b', class_id: 'class-a' })).toBe(true);
  });

  it('builds SQL predicates exclusively from canonical ids', () => {
    expect(resultScopePredicate(admin, 'r')).toEqual({ sql: '1 = 1', bindings: [] });
    expect(resultScopePredicate(student, 'r')).toEqual({ sql: 'r.student_id = ?', bindings: ['student-a'] });
    const teacherPredicate = resultScopePredicate(teacher, 'r');
    expect(teacherPredicate.sql).toBe('r.class_id IN (?)');
    expect(teacherPredicate.bindings).toEqual(['class-a']);
    expect(teacherPredicate.sql).not.toMatch(/student_name|class_name/i);
  });
});
