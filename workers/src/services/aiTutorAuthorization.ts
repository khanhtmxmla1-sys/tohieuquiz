import type { JWTPayload } from '../utils/jwt';

export interface AuthorizedAiTutorResult {
  id: string;
  student_id: string | null;
  assignment_id: string | null;
  quiz_id: string;
  class_name: string;
  answers: string | null;
}

const RESULT_COLUMNS = 'CAST(r.id AS TEXT) AS id, r.student_id, r.assignment_id, r.quiz_id, r.class_name, r.answers';

export async function loadAuthorizedAiTutorResult(
  db: D1Database,
  user: Pick<JWTPayload, 'username' | 'role'>,
  resultId: string,
): Promise<AuthorizedAiTutorResult | null> {
  if (user.role === 'admin') {
    return db.prepare(`SELECT ${RESULT_COLUMNS} FROM results r WHERE CAST(r.id AS TEXT) = ? LIMIT 1`)
      .bind(resultId)
      .first<AuthorizedAiTutorResult>();
  }

  if (user.role === 'student') {
    return db.prepare(`
      SELECT ${RESULT_COLUMNS}
      FROM results r
      INNER JOIN students s ON s.id = r.student_id
      WHERE CAST(r.id AS TEXT) = ? AND s.username = ?
      LIMIT 1
    `).bind(resultId, user.username).first<AuthorizedAiTutorResult>();
  }

  if (user.role === 'teacher') {
    return db.prepare(`
      SELECT ${RESULT_COLUMNS}
      FROM results r
      WHERE CAST(r.id AS TEXT) = ?
        AND EXISTS (
          SELECT 1 FROM classes c
          WHERE c.name = r.class_name AND c.teacher_username = ?
        )
      LIMIT 1
    `).bind(resultId, user.username).first<AuthorizedAiTutorResult>();
  }

  return null;
}
