import { errorResponse, jsonResponse } from '../../utils/response';
import { mapPhieu, getXepLoai } from './phieuMapper';
import { invalidatePhieuOgCache } from './ogCacheService';

export async function handleUpsertPhieu(db: D1Database, body: any, ogImages?: R2Bucket): Promise<Response> {
    const data = body.data || body;
    if (!data.submission_id) return errorResponse('Missing submission_id');
    if (!data.student_id) return errorResponse('Missing student_id');

    const now = new Date().toISOString();
    const existing = await db.prepare('SELECT id, version, created_by FROM phieu_nhanxet WHERE submission_id = ?')
        .bind(data.submission_id)
        .first<any>();
    if (existing && data.id && String(data.id) !== String(existing.id)) {
        return errorResponse('Phieu id does not match submission', 409);
    }
    const id = existing?.id || data.id || `phieu-${crypto.randomUUID().slice(0, 12)}`;
    const rawScore = Number(data.diem_so);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(10, rawScore)) : 0;
    const xepLoai = data.xep_loai || getXepLoai(score);
    const createdBy = existing?.created_by || data.created_by || 'teacher';

    if (existing) {
        await db.prepare(`
            UPDATE phieu_nhanxet
            SET student_id = ?, student_name = ?, class_id = ?, mon_hoc = ?, ten_bai_tap = ?,
                ngay_lam_bai = ?, tong_cau = ?, so_cau_dung = ?, so_cau_sai = ?, diem_so = ?,
                xep_loai = ?, nhan_xet_mode = ?, nhan_xet_style = ?, nhan_xet = ?,
                noi_dung_co_gang = ?, loi_dong_vien = ?, status = ?, version = version + 1,
                created_by = ?, updated_at = ?
            WHERE submission_id = ?
        `).bind(
            data.student_id,
            data.student_name,
            data.class_id,
            data.mon_hoc || '',
            data.ten_bai_tap || '',
            data.ngay_lam_bai || '',
            Number(data.tong_cau) || 0,
            Number(data.so_cau_dung) || 0,
            Number(data.so_cau_sai) || 0,
            score,
            xepLoai,
            data.nhan_xet_mode || 'ai',
            data.nhan_xet_style || 'nhe_nhang',
            data.nhan_xet || '',
            data.noi_dung_co_gang || '',
            data.loi_dong_vien || '',
            data.status || 'draft',
            createdBy,
            now,
            data.submission_id
        ).run();
    } else {
        await db.prepare(`
            INSERT INTO phieu_nhanxet (
                id, submission_id, student_id, student_name, class_id, mon_hoc, ten_bai_tap,
                ngay_lam_bai, tong_cau, so_cau_dung, so_cau_sai, diem_so, xep_loai,
                nhan_xet_mode, nhan_xet_style, nhan_xet, noi_dung_co_gang, loi_dong_vien,
                status, version, created_by, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).bind(
            id,
            data.submission_id,
            data.student_id,
            data.student_name,
            data.class_id,
            data.mon_hoc || '',
            data.ten_bai_tap || '',
            data.ngay_lam_bai || '',
            Number(data.tong_cau) || 0,
            Number(data.so_cau_dung) || 0,
            Number(data.so_cau_sai) || 0,
            score,
            xepLoai,
            data.nhan_xet_mode || 'ai',
            data.nhan_xet_style || 'nhe_nhang',
            data.nhan_xet || '',
            data.noi_dung_co_gang || '',
            data.loi_dong_vien || '',
            data.status || 'draft',
            createdBy,
            now,
            now
        ).run();
    }

    const saved = await db.prepare('SELECT * FROM phieu_nhanxet WHERE submission_id = ?')
        .bind(data.submission_id)
        .first<any>();
    if (!saved) return errorResponse('Unable to load saved phieu', 500);

    await invalidatePhieuOgCache(db, ogImages, id);
    return jsonResponse({ status: 'success', data: mapPhieu(saved) });
}
