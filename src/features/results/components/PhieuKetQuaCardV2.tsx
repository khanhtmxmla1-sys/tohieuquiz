import React from 'react';
import { PhieuNhanXet, PhieuNhanXetInput } from '../../homework/types/phieu.types';
import { formatPhieuDate, formatPhieuScore } from '../utils/phieuFormat';

interface Props {
  phieu: PhieuNhanXet | PhieuNhanXetInput;
  editable?: boolean;
  onChange?: (patch: Partial<PhieuNhanXetInput>) => void;
  tenGVCN?: string;
}

// Mẫu phiếu theo thiết kế: nền trắng, viền xanh dương, có icon từng mục
export const PhieuKetQuaCardV2: React.FC<Props> = ({ phieu, editable = false, onChange, tenGVCN }) => {
  const update = (field: keyof PhieuNhanXetInput, value: string) => onChange?.({ [field]: value });

  const tongCau = Number(phieu.tong_cau || 0);
  const soCauDung = Number(phieu.so_cau_dung || 0);
  const soCauSai = Number(phieu.so_cau_sai || 0);

  const ngayFormatted = formatPhieuDate(phieu.ngay_lam_bai);

  return (
    <article
      className="relative bg-white rounded-3xl overflow-hidden print:shadow-none"
      style={{
        border: '3px solid #60a5fa',
        boxShadow: '0 4px 24px 0 rgba(96,165,250,0.15)',
        maxWidth: 480,
      }}
    >
      {/* Tiêu đề */}
      <div
        className="text-center py-4 px-6"
        style={{
          background: 'linear-gradient(90deg, #dbeafe 0%, #bfdbfe 50%, #dbeafe 100%)',
          borderBottom: '2px solid #93c5fd',
        }}
      >
        <h2
          className="font-black text-blue-800 tracking-wider"
          style={{ fontSize: 20, letterSpacing: 2 }}
        >
          🎓 PHIẾU KẾT QUẢ LÀM BÀI TẬP
        </h2>
      </div>

      {/* Thông tin học sinh */}
      <div className="px-6 pt-5 pb-3 space-y-2">
        <InfoRow icon="👤" label="Họ và tên học sinh" value={phieu.student_name} />
        <InfoRow icon="🏫" label="Lớp" value={phieu.class_id || '---'} />
        <InfoRow icon="📚" label="Môn học" value={phieu.mon_hoc || '---'} />
        <InfoRow icon="✏️" label="Tên bài tập" value={phieu.ten_bai_tap || '---'} />
        <InfoRow icon="📅" label="Ngày làm bài" value={ngayFormatted} />
      </div>

      {/* Kết quả bài làm */}
      <div className="px-6 pb-4">
        <div
          className="text-center text-sm font-black text-blue-700 py-1.5 rounded-xl mb-3"
          style={{ background: '#dbeafe', border: '1.5px solid #93c5fd' }}
        >
          KẾT QUẢ BÀI LÀM
        </div>
        <div className="grid grid-cols-5 gap-2">
          <ResultBox
            icon="📋"
            label="Tổng số câu"
            value={tongCau > 0 ? String(tongCau) : '---'}
            color="#dbeafe"
            borderColor="#93c5fd"
          />
          <ResultBox
            icon="✅"
            label="Số câu đúng"
            value={String(soCauDung)}
            color="#dcfce7"
            borderColor="#86efac"
          />
          <ResultBox
            icon="❌"
            label="Số câu sai"
            value={String(soCauSai)}
            color="#fee2e2"
            borderColor="#fca5a5"
          />
          <ResultBox
            icon="⭐"
            label="Điểm số"
            value={formatPhieuScore(phieu.diem_so)}
            color="#fef9c3"
            borderColor="#fde047"
          />
          <ResultBox
            icon="🏆"
            label="Xếp loại"
            value={phieu.xep_loai || '---'}
            color="#fef3c7"
            borderColor="#fcd34d"
          />
        </div>
      </div>

      {/* Nhận xét của giáo viên */}
      <EditSection
        icon="💬"
        label="NHẬN XÉT CỦA GIÁO VIÊN"
        labelColor="#1e40af"
        bgColor="#eff6ff"
        borderColor="#93c5fd"
        value={phieu.nhan_xet || ''}
        editable={editable}
        onChange={(v) => update('nhan_xet', v)}
        rows={3}
      />

      {/* Nội dung cần cố gắng */}
      <EditSection
        icon="🎯"
        label="NỘI DUNG CẦN CỐ GẮNG THÊM"
        labelColor="#15803d"
        bgColor="#f0fdf4"
        borderColor="#86efac"
        value={phieu.noi_dung_co_gang || ''}
        editable={editable}
        onChange={(v) => update('noi_dung_co_gang', v)}
        rows={2}
      />

      {/* Lời động viên */}
      <EditSection
        icon="⭐"
        label="LỜI ĐỘNG VIÊN"
        labelColor="#92400e"
        bgColor="#fffbeb"
        borderColor="#fde68a"
        value={phieu.loi_dong_vien || ''}
        editable={editable}
        onChange={(v) => update('loi_dong_vien', v)}
        rows={2}
      />

      {/* Chữ ký GVCN */}
      <div className="px-6 pb-6 pt-2">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-slate-500 italic">Giáo viên chủ nhiệm</p>
          <div className="w-32 border-b border-slate-400 mt-4 mb-1" />
          <p className="text-sm font-black text-slate-700 tracking-wide">
            {tenGVCN || (phieu as PhieuNhanXet).teacher_name || (phieu as PhieuNhanXet).created_by || ''}
          </p>
        </div>
      </div>
    </article>
  );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2 text-sm">
    <span className="text-base">{icon}</span>
    <span className="font-semibold text-slate-600 whitespace-nowrap">{label}</span>
    <span className="flex-1 border-b border-dotted border-slate-300 text-slate-700 pb-0.5 ml-1">
      {value}
    </span>
  </div>
);

const ResultBox: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  borderColor: string;
}> = ({ icon, label, value, color, borderColor }) => (
  <div
    className="rounded-xl flex flex-col items-center py-2 px-1 text-center"
    style={{ background: color, border: `1.5px dashed ${borderColor}` }}
  >
    <span className="text-xl mb-1">{icon}</span>
    <p className="text-[10px] font-bold text-slate-600 leading-tight">{label}</p>
    <p className="text-lg font-black text-slate-800 mt-1">{value}</p>
  </div>
);

const EditSection: React.FC<{
  icon: string;
  label: string;
  labelColor: string;
  bgColor: string;
  borderColor: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  rows?: number;
}> = ({ icon, label, labelColor, bgColor, borderColor, value, editable, onChange, rows = 3 }) => (
  <div className="px-6 mb-3">
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl mb-2 text-xs font-black tracking-wider"
      style={{ background: bgColor, border: `1.5px solid ${borderColor}`, color: labelColor }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    {editable ? (
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 resize-none"
      />
    ) : (
      <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap min-h-[2.5rem]">
        {value || <span className="text-slate-300 italic">Chưa có nội dung</span>}
      </p>
    )}
  </div>
);
