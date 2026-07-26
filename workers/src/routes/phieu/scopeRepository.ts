import type { PhieuScopeUser, ResultScope } from './types';

export async function getSubmissionScope(
  db: D1Database,
  submissionId: string,
): Promise<any | null> {
  return db.prepare(`
    SELECT hs.id AS submission_id, hs.student_id, hs.student_name, ha.class_id, c.teacher_username
    FROM hw_submissions hs
    JOIN hw_assignments ha ON ha.id = hs.assignment_id
    JOIN classes c ON c.id = ha.class_id
    WHERE hs.id = ?
    LIMIT 1
  `).bind(submissionId).first<any>();
}

export async function getPhieuScope(db: D1Database, phieuId: string): Promise<any | null> {
  return db.prepare(`
    SELECT p.id, p.class_id, c.teacher_username
    FROM phieu_nhanxet p
    JOIN classes c ON c.id = p.class_id
    WHERE p.id = ?
    LIMIT 1
  `).bind(phieuId).first<any>();
}

export async function getPublicLinkScope(
  db: D1Database,
  publicToken: string,
): Promise<any | null> {
  return db.prepare(`
    SELECT p.id, p.class_id, c.teacher_username
    FROM phieu_public_links l
    JOIN phieu_nhanxet p ON p.id = l.phieu_id
    JOIN classes c ON c.id = p.class_id
    WHERE l.public_token = ?
    LIMIT 1
  `).bind(publicToken).first<any>();
}

export async function getResultScope(
  db: D1Database,
  resultId: string,
  user: PhieuScopeUser,
): Promise<ResultScope | null> {
  return db.prepare(`
    SELECT
      CAST(r.id AS TEXT) AS result_id,
      s.id AS student_id,
      r.student_name,
      c.id AS class_id,
      c.teacher_username,
      COALESCE(q.category, '') AS mon_hoc,
      r.quiz_title AS ten_bai_tap,
      r.submitted_at AS ngay_lam_bai,
      r.total_questions AS tong_cau,
      r.correct_count AS so_cau_dung,
      MAX(0, r.total_questions - r.correct_count) AS so_cau_sai,
      r.score AS diem_so
    FROM results r
    JOIN classes c
      ON LOWER(TRIM(c.name)) = LOWER(TRIM(r.class_name))
     AND COALESCE(c.archived_at, '') = ''
    JOIN students s
      ON s.class_id = c.id
     AND LOWER(TRIM(s.full_name)) = LOWER(TRIM(r.student_name))
     AND COALESCE(s.archived_at, '') = ''
    LEFT JOIN quizzes q ON q.id = r.quiz_id
    WHERE CAST(r.id AS TEXT) = ?
    ORDER BY CASE WHEN c.teacher_username = ? THEN 0 ELSE 1 END, c.id
    LIMIT 1
  `).bind(resultId, user.username).first<ResultScope>();
}
