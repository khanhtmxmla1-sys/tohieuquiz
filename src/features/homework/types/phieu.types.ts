import { HomeworkAssignment, HomeworkSubmission } from './index';

export type PhieuNhanXetStyle = 'nhe_nhang' | 'nghiem_tuc' | 'vui_ve';
export type PhieuNhanXetStatus = 'draft' | 'reviewed' | 'published';

export interface PhieuNhanXet {
  id: string;
  submission_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  mon_hoc: string;
  ten_bai_tap: string;
  ngay_lam_bai: string;
  tong_cau: number;
  so_cau_dung: number;
  so_cau_sai: number;
  diem_so: number;
  xep_loai: string;
  nhan_xet_mode: 'ai' | 'manual';
  nhan_xet_style: PhieuNhanXetStyle;
  nhan_xet: string;
  noi_dung_co_gang: string;
  loi_dong_vien: string;
  status: PhieuNhanXetStatus;
  version: number;
  created_by: string;
  teacher_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PhieuNhanXetInput {
  id?: string;
  submission_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  mon_hoc?: string;
  ten_bai_tap?: string;
  ngay_lam_bai?: string;
  tong_cau?: number;
  so_cau_dung?: number;
  so_cau_sai?: number;
  diem_so?: number;
  xep_loai?: string;
  nhan_xet_mode?: 'ai' | 'manual';
  nhan_xet_style?: PhieuNhanXetStyle;
  nhan_xet?: string;
  noi_dung_co_gang?: string;
  loi_dong_vien?: string;
  status?: PhieuNhanXetStatus;
  created_by?: string;
}

export interface PhieuPublicLink {
  phieuId: string;
  studentName: string;
  publicToken: string;
  url: string;
}

export interface PublishPhieuBatchInput {
  assignmentId: string;
  classId: string;
  teacherId: string;
  title: string;
  phieuIds: string[];
  expiresInDays?: number;
}

export interface PublishPhieuBatchResult {
  batchId: string;
  links: PhieuPublicLink[];
}

export interface PublicPhieuResult {
  phieu: PhieuNhanXet;
  title: string;
}

export interface PhieuDraftSource {
  assignment: HomeworkAssignment;
  submission: HomeworkSubmission;
  style: PhieuNhanXetStyle;
  teacherId: string;
}
