import type { JWTPayload } from '../utils/jwt';
import { errorResponse } from '../utils/response';

export interface AuthorizedParentStudent {
  studentId: string;
  classId: string;
  className: string;
  fullName: string;
}

export interface AuthorizedParentClass {
  classId: string;
  className: string;
  teacherUsername: string;
}

export async function requireTeacherForParentClass(
  db: D1Database,
  user: JWTPayload,
  classId: string,
): Promise<AuthorizedParentClass | Response> {
  const row = await db.prepare(`
    SELECT id, name, teacher_username
    FROM classes
    WHERE id = ? AND COALESCE(archived_at, '') = ''
    LIMIT 1
  `).bind(classId).first<{
    id: string;
    name: string;
    teacher_username: string;
  }>();
  if (!row) return errorResponse('Class not found', 404);
  if (user.role !== 'admin' && row.teacher_username !== user.username) {
    return errorResponse('Forbidden', 403);
  }
  return {
    classId: row.id,
    className: row.name,
    teacherUsername: row.teacher_username,
  };
}

export async function requireTeacherForParentStudent(
  db: D1Database,
  user: JWTPayload,
  studentId: string,
): Promise<AuthorizedParentStudent | Response> {
  const row = await db.prepare(`
    SELECT s.id AS student_id, s.full_name, s.class_id,
           c.name AS class_name, c.teacher_username
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.id = ?
      AND COALESCE(s.archived_at, '') = ''
      AND COALESCE(c.archived_at, '') = ''
    LIMIT 1
  `).bind(studentId).first<{
    student_id: string;
    full_name: string;
    class_id: string;
    class_name: string;
    teacher_username: string;
  }>();

  if (!row) return errorResponse('Student not found', 404);
  if (user.role !== 'admin' && row.teacher_username !== user.username) {
    return errorResponse('Forbidden', 403);
  }
  return {
    studentId: row.student_id,
    classId: row.class_id,
    className: row.class_name,
    fullName: row.full_name,
  };
}
