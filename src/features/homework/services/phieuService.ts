import { callApi } from '../../../services/apiAdapter';
import {
  PhieuDraftSource,
  PhieuNhanXet,
  PhieuNhanXetInput,
  PhieuNhanXetStyle,
  PublicPhieuResult,
} from '../types/phieu.types';

const styleLabels: Record<PhieuNhanXetStyle, string> = {
  nhe_nhang: 'Nhẹ nhàng, khích lệ',
  nghiem_tuc: 'Nghiêm túc, cụ thể',
  vui_ve: 'Vui vẻ, gần gũi',
};

export const getXepLoai = (score: number): string => {
  if (score >= 9) return 'Xuất sắc';
  if (score >= 8) return 'Giỏi';
  if (score >= 6.5) return 'Khá';
  if (score >= 5) return 'Trung bình';
  return 'Yếu';
};

const buildNhanXet = (studentName: string, score: number, style: PhieuNhanXetStyle) => {
  const xepLoai = getXepLoai(score);

  if (style === 'nghiem_tuc') {
    return {
      nhan_xet: `${studentName} đạt mức ${xepLoai.toLowerCase()} với ${score}/10 điểm. Em cần rà soát kỹ các phần còn sai và trình bày câu trả lời rõ ràng hơn.`,
      noi_dung_co_gang: 'Tập trung sửa lỗi sai, luyện lại dạng bài chưa chắc và kiểm tra bài trước khi nộp.',
      loi_dong_vien: 'Cố gắng đều mỗi ngày, kết quả sẽ tiến bộ rõ rệt.',
    };
  }

  if (style === 'vui_ve') {
    return {
      nhan_xet: `${studentName} đã hoàn thành bài với tinh thần tốt và đạt ${score}/10 điểm. Những phần làm đúng cho thấy em đang nắm bài khá ổn.`,
      noi_dung_co_gang: 'Luyện thêm các câu còn nhầm và thử tự giải lại bài sau khi xem đáp án.',
      loi_dong_vien: 'Tiếp tục giữ nhịp học vui vẻ này nhé, em đang đi đúng hướng.',
    };
  }

  return {
    nhan_xet: `${studentName} đã có nhiều cố gắng trong bài làm và đạt ${score}/10 điểm. Em có nền tảng tốt ở các phần đã làm đúng.`,
    noi_dung_co_gang: 'Cần luyện thêm những câu còn sai, đọc kỹ đề và trình bày từng bước cẩn thận hơn.',
    loi_dong_vien: 'Thầy cô tin rằng em sẽ tiến bộ nếu duy trì sự chăm chỉ này.',
  };
};

export const createPhieuDraftInput = ({
  assignment,
  submission,
  style,
  teacherId,
}: PhieuDraftSource): PhieuNhanXetInput => {
  const score = Number(submission.score) || 0;
  const xepLoai = getXepLoai(score);
  const generated = buildNhanXet(submission.student_name, score, style);

  return {
    submission_id: submission.id,
    student_id: submission.student_id,
    student_name: submission.student_name,
    class_id: assignment.class_id,
    mon_hoc: assignment.subject || '',
    ten_bai_tap: assignment.title,
    ngay_lam_bai: submission.submitted_at,
    tong_cau: 10,
    so_cau_dung: Math.round(score),
    so_cau_sai: Math.max(0, 10 - Math.round(score)),
    diem_so: score,
    xep_loai: xepLoai,
    nhan_xet_mode: 'ai',
    nhan_xet_style: style,
    status: 'draft',
    created_by: teacherId,
    ...generated,
  };
};

export const phieuStyleLabels = styleLabels;

export const phieuService = {
  async upsertPhieu(data: PhieuNhanXetInput): Promise<PhieuNhanXet> {
    const response = await callApi<{ status: string; data: PhieuNhanXet; message?: string }>('upsert_phieu', data);
    if (response.status === 'success') return response.data;
    throw new Error(response.message || 'Không thể lưu phiếu nhận xét');
  },

  async getPhieuBySubmission(submissionId: string): Promise<PhieuNhanXet | null> {
    const response = await callApi<{ status: string; data: PhieuNhanXet | null; message?: string }>('get_phieu_by_submission', { submissionId });
    if (response.status === 'success') return response.data;
    throw new Error(response.message || 'Không thể tải phiếu nhận xét');
  },

  async getPublicPhieu(publicToken: string): Promise<PublicPhieuResult> {
    const response = await callApi<{ status: string; data: PublicPhieuResult; message?: string }>('get_public_phieu', { publicToken });
    if (response.status === 'success') return response.data;
    throw new Error(response.message || 'Phiếu không tồn tại hoặc đã hết hạn');
  },
};
