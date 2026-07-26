import { getActivePublicLinkByPhieuId } from './phieuRepository';
import { createPublicToken } from './publicTokenService';

export interface EnsurePublicPhieuLinkInput {
  phieuId: string;
  batchId: string;
  studentName: string;
  expiresAt: string | null;
  now?: string;
}

export async function ensureActivePublicPhieuLink(
  db: D1Database,
  input: EnsurePublicPhieuLinkInput,
): Promise<any> {
  const existing = await getActivePublicLinkByPhieuId(db, input.phieuId);
  if (existing) return existing;

  const now = input.now || new Date().toISOString();
  const publicToken = createPublicToken();
  const linkId = `pl-${crypto.randomUUID().slice(0, 12)}`;
  await db.prepare(`
    INSERT INTO phieu_public_links (
      id, phieu_id, batch_id, public_token, is_active, expires_at, view_count, created_at
    ) VALUES (?, ?, ?, ?, 1, ?, 0, ?)
  `).bind(
    linkId,
    input.phieuId,
    input.batchId,
    publicToken,
    input.expiresAt,
    now,
  ).run();
  await db.prepare(`
    INSERT OR IGNORE INTO phieu_batch_items (batch_id, phieu_id, student_name)
    VALUES (?, ?, ?)
  `).bind(input.batchId, input.phieuId, input.studentName).run();
  await db.prepare("UPDATE phieu_nhanxet SET status = 'published', updated_at = ? WHERE id = ?")
    .bind(now, input.phieuId).run();

  const created = await getActivePublicLinkByPhieuId(db, input.phieuId);
  if (!created) throw new Error('Unable to create public link');
  return created;
}
