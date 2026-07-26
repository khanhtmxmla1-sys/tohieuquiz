import { PUBLIC_PHIEU_HOST } from './constants';

export function mapPublicLink(row: any): any {
  return row ? ({
    phieuId: String(row.phieu_id || row.phieuId || ''),
    studentName: String(row.student_name || row.studentName || ''),
    publicToken: String(row.public_token || row.publicToken || ''),
    url: `https://${PUBLIC_PHIEU_HOST}/p/${encodeURIComponent(String(row.public_token || row.publicToken || ''))}`,
  }) : null;
}

export function mapPhieu(row: any): any {
  return {
    id: row.id,
    submission_id: row.submission_id,
    student_id: row.student_id,
    student_name: row.student_name,
    class_id: row.class_id,
    mon_hoc: row.mon_hoc || '',
    ten_bai_tap: row.ten_bai_tap || '',
    ngay_lam_bai: row.ngay_lam_bai || '',
    tong_cau: Number(row.tong_cau) || 0,
    so_cau_dung: Number(row.so_cau_dung) || 0,
    so_cau_sai: Number(row.so_cau_sai) || 0,
    diem_so: Number(row.diem_so) || 0,
    xep_loai: row.xep_loai || 'Trung bình',
    nhan_xet_mode: row.nhan_xet_mode || 'ai',
    nhan_xet_style: row.nhan_xet_style || 'nhe_nhang',
    nhan_xet: row.nhan_xet || '',
    noi_dung_co_gang: row.noi_dung_co_gang || '',
    loi_dong_vien: row.loi_dong_vien || '',
    status: row.status || 'draft',
    version: Number(row.version) || 1,
    created_by: row.created_by || 'teacher',
    teacher_name: row.teacher_full_name || row.teacher_name || row.created_by || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
}

export function getXepLoai(score: number): string {
  if (score >= 9) return 'Xuất sắc';
  if (score >= 8) return 'Giỏi';
  if (score >= 6.5) return 'Khá';
  if (score >= 5) return 'Trung bình';
  return 'Yếu';
}
