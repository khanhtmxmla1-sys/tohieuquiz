import React from 'react';
import type { ResultReportCohortReadyItem, ResultReportDraftInput } from '../../../../../shared/result-reports.contract';
import { PhieuBTCard } from '../PhieuBTCard';

interface StudentReportPreviewProps {
  item: ResultReportCohortReadyItem;
  draft: ResultReportDraftInput;
  className: string;
  quizTitle: string;
  teacherName: string;
  onChange: (patch: Partial<ResultReportDraftInput>) => void;
  onRegenerate: () => void;
}

export const StudentReportPreview: React.FC<StudentReportPreviewProps> = ({
  item, draft, className, quizTitle, teacherName, onChange, onRegenerate,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500">Đang xem trước</p>
        <h4 className="font-semibold text-slate-900">{item.student.fullName}</h4>
      </div>
      <button type="button" onClick={onRegenerate} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">
        Tạo lại nhận xét
      </button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
      <PhieuBTCard
        editable
        editableIdentity={false}
        tenGVCN={teacherName}
        phieu={{
          submission_id: `result:${item.result.id}`,
          student_id: item.student.id,
          student_name: item.student.fullName,
          class_id: className,
          mon_hoc: '',
          ten_bai_tap: quizTitle,
          ngay_lam_bai: item.result.submittedAt,
          tong_cau: item.result.totalQuestions,
          so_cau_dung: item.result.correctCount,
          so_cau_sai: Math.max(0, item.result.totalQuestions - item.result.correctCount),
          diem_so: item.result.score,
          xep_loai: '',
          nhan_xet_mode: draft.commentMode === 'manual' ? 'manual' : 'ai',
          nhan_xet_style: draft.style,
          nhan_xet: draft.comment,
          noi_dung_co_gang: draft.needsImprovement,
          loi_dong_vien: draft.encouragement,
          status: 'draft',
          created_by: '',
        }}
        onChange={(patch) => {
          const next: Partial<ResultReportDraftInput> = {};
          if (patch.nhan_xet !== undefined) next.comment = patch.nhan_xet;
          if (patch.noi_dung_co_gang !== undefined) next.needsImprovement = patch.noi_dung_co_gang;
          if (patch.loi_dong_vien !== undefined) next.encouragement = patch.loi_dong_vien;
          onChange(next);
        }}
      />
    </div>
  </div>
);
