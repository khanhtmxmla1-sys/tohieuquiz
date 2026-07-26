import { mapPublicLink } from './phieuMapper';

export const resultSubmissionKey = (resultId: string): string => `result:${resultId}`;

export async function getResultPhieuRecord(
  db: D1Database,
  resultId: string,
): Promise<any | null> {
  const canonicalKey = resultSubmissionKey(resultId);
  return db.prepare(`
    SELECT *
    FROM phieu_nhanxet
    WHERE submission_id IN (?, ?)
    ORDER BY CASE WHEN submission_id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(canonicalKey, resultId, canonicalKey).first<any>();
}

export async function getActivePublicLinkByPhieuId(
  db: D1Database,
  phieuId: string,
): Promise<any | null> {
  const row = await db.prepare(`
    SELECT l.phieu_id, l.id, l.batch_id, l.public_token, l.expires_at, p.student_name
    FROM phieu_public_links l
    JOIN phieu_nhanxet p ON p.id = l.phieu_id
    WHERE l.phieu_id = ?
      AND l.is_active = 1
      AND (l.expires_at IS NULL OR l.expires_at > datetime('now'))
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 1
  `).bind(phieuId).first<any>();
  return row ? {
    ...mapPublicLink(row),
    id: String(row.id || ''),
    batchId: String(row.batch_id || ''),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
  } : null;
}

export async function getPublicPhieuRecord(
  db: D1Database,
  publicToken: string,
): Promise<any | null> {
  return db.prepare(`
    SELECT p.*, b.title as batch_title, t.full_name as teacher_full_name
    FROM phieu_public_links l
    JOIN phieu_nhanxet p ON p.id = l.phieu_id
    LEFT JOIN phieu_batch b ON b.id = l.batch_id
    LEFT JOIN teachers t ON t.username = p.created_by
    WHERE l.public_token = ?
      AND l.is_active = 1
      AND (l.expires_at IS NULL OR l.expires_at > datetime('now'))
    LIMIT 1
  `).bind(publicToken).first<any>();
}

export async function getPhieuBySubmission(
  db: D1Database,
  submissionId: string,
): Promise<any | null> {
  return db.prepare('SELECT * FROM phieu_nhanxet WHERE submission_id = ?')
    .bind(submissionId)
    .first<any>();
}
