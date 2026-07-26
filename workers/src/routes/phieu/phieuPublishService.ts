import { errorResponse, jsonResponse } from '../../utils/response';
import { getActivePublicLinkByPhieuId } from './phieuRepository';
import { createPublicToken } from './publicTokenService';

export async function handlePublishPhieuBatch(db: D1Database, body: any): Promise<Response> {
    const data = body.data || body;
    const phieuIds: string[] = Array.isArray(data.phieuIds)
        ? Array.from(new Set(data.phieuIds.map(String).map((id: string) => id.trim()).filter(Boolean)))
        : [];
    if (phieuIds.length === 0) return errorResponse('Missing phieuIds');

    const now = new Date().toISOString();
    const newBatchId = `pb-${crypto.randomUUID().slice(0, 12)}`;
    const rawDays = data.expiresInDays != null ? Number(data.expiresInDays) : NaN;
    const expiresAt = Number.isFinite(rawDays) && rawDays > 0
        ? new Date(Date.now() + rawDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const phieuRows: any[] = [];
    const linksByPhieuId = new Map<string, any>();
    for (const phieuId of phieuIds) {
        const phieu = await db.prepare('SELECT id, student_name FROM phieu_nhanxet WHERE id = ?')
            .bind(phieuId)
            .first<any>();
        if (!phieu) return errorResponse('Phieu not found', 404);
        phieuRows.push(phieu);
        const existingLink = await getActivePublicLinkByPhieuId(db, phieu.id);
        if (existingLink) linksByPhieuId.set(phieu.id, existingLink);
    }

    const missingRows = phieuRows.filter((phieu) => !linksByPhieuId.has(phieu.id));
    let insertedCount = 0;
    if (missingRows.length > 0) {
        await db.prepare(`
            INSERT INTO phieu_batch (id, assignment_id, class_id, teacher_id, title, created_at, expires_at, view_count, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
        `).bind(
            newBatchId,
            data.assignmentId || '',
            data.classId || '',
            data.teacherId || 'teacher',
            data.title || 'Phiếu Kết Quả Học Tập',
            now,
            expiresAt
        ).run();

        for (const phieu of missingRows) {
            const publicToken = createPublicToken();
            const linkId = `pl-${crypto.randomUUID().slice(0, 12)}`;
            const inserted = await db.prepare(`
                INSERT INTO phieu_public_links (
                    id, phieu_id, batch_id, public_token, is_active, expires_at, view_count, created_at
                )
                SELECT ?, ?, ?, ?, 1, ?, 0, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM phieu_public_links
                    WHERE phieu_id = ?
                      AND is_active = 1
                      AND (expires_at IS NULL OR expires_at > datetime('now'))
                )
            `).bind(linkId, phieu.id, newBatchId, publicToken, expiresAt, now, phieu.id).run();

            if (Number((inserted as any)?.meta?.changes || 0) > 0) {
                insertedCount += 1;
                await db.prepare('INSERT OR IGNORE INTO phieu_batch_items (batch_id, phieu_id, student_name) VALUES (?, ?, ?)')
                    .bind(newBatchId, phieu.id, phieu.student_name)
                    .run();
                await db.prepare("UPDATE phieu_nhanxet SET status = 'published', updated_at = ? WHERE id = ?")
                    .bind(now, phieu.id)
                    .run();
            }

            const activeLink = await getActivePublicLinkByPhieuId(db, phieu.id);
            if (!activeLink) return errorResponse('Unable to create public link', 500);
            linksByPhieuId.set(phieu.id, activeLink);
        }

        if (insertedCount === 0) {
            await db.prepare('DELETE FROM phieu_batch WHERE id = ?').bind(newBatchId).run();
        }
    }

    const links = phieuRows.map((phieu) => {
        const link = linksByPhieuId.get(phieu.id);
        return {
            phieuId: link.phieuId,
            studentName: link.studentName,
            publicToken: link.publicToken,
            url: link.url,
        };
    });
    const batchId = insertedCount > 0
        ? newBatchId
        : String(linksByPhieuId.get(phieuRows[0].id)?.batchId || '');

    return jsonResponse({ status: 'success', data: { batchId, links } });
}
