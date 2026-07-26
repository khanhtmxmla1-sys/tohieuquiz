/**
 * buildPhieuFromResult
 * Pure helper — chuyển một StudentResult thành PhieuNhanXetInput.
 * Tách từ PhieuFromResultsPanel để tái sử dụng ở modal per-row.
 *
 * @blueprint senior-engineering-toolkit
 */

import type { PhieuNhanXetInput, PhieuNhanXetStyle } from '../../homework/types/phieu.types';
import type { StudentResult } from '../../../types';
import { getXepLoai } from '../../homework/services/phieuService';

export function buildPhieuFromResult(
  result: StudentResult,
  quizTitle: string,
  style: PhieuNhanXetStyle = 'nhe_nhang',
  teacherId: string = '',
): PhieuNhanXetInput {
  const studentName = result.studentName ?? '';
  const classId     = result.studentClass ?? '';
  const score       = Number(result.score ?? 0);
  const totalQ      = Number(result.totalQuestions ?? 0);
  const correctCount = Number(result.correctCount ?? 0);
  const wrongCount   = Math.max(0, totalQ - correctCount);
  const xepLoai      = getXepLoai(score);

  const buildNhanXet = (name: string, s: number) => {
    if (style === 'nghiem_tuc') return {
      nhan_xet: `${name} đạt mức ${xepLoai.toLowerCase()} với ${s}/10 điểm. Em cần rà soát kỹ các phần còn sai và trình bày câu trả lời rõ ràng hơn.`,
      noi_dung_co_gang: 'Tập trung sửa lỗi sai, luyện lại dạng bài chưa chắc và kiểm tra bài trước khi nộp.',
      loi_dong_vien: 'Cố gắng đều mỗi ngày, kết quả sẽ tiến bộ rõ rệt.',
    };
    if (style === 'vui_ve') return {
      nhan_xet: `${name} đã hoàn thành bài với tinh thần tốt và đạt ${s}/10 điểm. Những phần làm đúng cho thấy em đang nắm bài khá ổn.`,
      noi_dung_co_gang: 'Luyện thêm các câu còn nhầm và thử tự giải lại bài sau khi xem đáp án.',
      loi_dong_vien: 'Tiếp tục giữ nhịp học vui vẻ này nhé, em đang đi đúng hướng.',
    };
    return {
      nhan_xet: `${name} đã có nhiều cố gắng trong bài làm và đạt ${s}/10 điểm. Em có nền tảng tốt ở các phần đã làm đúng.`,
      noi_dung_co_gang: 'Cần luyện thêm những câu còn sai, đọc kỹ đề và trình bày từng bước cẩn thận hơn.',
      loi_dong_vien: 'Thầy cô tin rằng em sẽ tiến bộ nếu duy trì sự chăm chỉ này.',
    };
  };

  const resultKey = `result:${String(result.id)}`;

  return {
    submission_id:  resultKey,
    student_id:     resultKey,
    student_name:   studentName,
    class_id:       classId,
    mon_hoc:        '',
    ten_bai_tap:    quizTitle,
    ngay_lam_bai:   result.submittedAt ?? '',
    tong_cau:       totalQ,
    so_cau_dung:    correctCount,
    so_cau_sai:     wrongCount,
    diem_so:        score,
    xep_loai:       xepLoai,
    nhan_xet_mode:  'ai',
    nhan_xet_style: style,
    status:         'draft',
    created_by:     teacherId,
    ...buildNhanXet(studentName, score),
  };
}
