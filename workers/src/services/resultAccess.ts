import type { JWTPayload } from '../utils/jwt';

export type ResultAccessRole = 'admin' | 'teacher' | 'student';

export interface ResultAccessScope {
  role: ResultAccessRole;
  studentId: string | null;
  classIds: string[];
}

export interface CanonicalResultIdentity {
  student_id?: string | null;
  class_id?: string | null;
}

const activeRecordClause = "COALESCE(archived_at, '') = ''";

export async function resolveResultAccessScope(
  db: D1Database,
  user: JWTPayload,
): Promise<ResultAccessScope> {
  if (user.role === 'admin') {
    return { role: 'admin', studentId: null, classIds: [] };
  }

  if (user.role === 'student') {
    const student = await db.prepare(`
      SELECT id, class_id
      FROM students
      WHERE username = ? AND ${activeRecordClause}
      LIMIT 1
    `).bind(user.username).first<{ id: string; class_id: string | null }>();
    return {
      role: 'student',
      studentId: student?.id || null,
      classIds: student?.class_id ? [student.class_id] : [],
    };
  }

  const rows = await db.prepare(`
    SELECT id
    FROM classes
    WHERE teacher_username = ? AND ${activeRecordClause}
    ORDER BY id
  `).bind(user.username).all<{ id: string }>();
  return {
    role: 'teacher',
    studentId: null,
    classIds: (rows.results || []).map((row) => row.id).filter(Boolean),
  };
}

export function canAccessCanonicalResult(
  scope: ResultAccessScope,
  result: CanonicalResultIdentity,
): boolean {
  if (scope.role === 'admin') return true;
  if (scope.role === 'student') {
    return Boolean(scope.studentId && result.student_id && result.student_id === scope.studentId);
  }
  return Boolean(result.class_id && scope.classIds.includes(result.class_id));
}

export function resultScopePredicate(
  scope: ResultAccessScope,
  alias = 'results',
): { sql: string; bindings: string[] } {
  if (scope.role === 'admin') return { sql: '1 = 1', bindings: [] };
  if (scope.role === 'student') {
    return scope.studentId
      ? { sql: `${alias}.student_id = ?`, bindings: [scope.studentId] }
      : { sql: '1 = 0', bindings: [] };
  }
  if (scope.classIds.length === 0) return { sql: '1 = 0', bindings: [] };
  return {
    sql: `${alias}.class_id IN (${scope.classIds.map(() => '?').join(', ')})`,
    bindings: [...scope.classIds],
  };
}
