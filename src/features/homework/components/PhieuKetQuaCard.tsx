import React from 'react';
import { PhieuNhanXet, PhieuNhanXetInput } from '../types/phieu.types';

interface PhieuKetQuaCardProps {
  phieu: PhieuNhanXet | PhieuNhanXetInput;
  editable?: boolean;
  onChange?: (patch: Partial<PhieuNhanXetInput>) => void;
}

export const PhieuKetQuaCard: React.FC<PhieuKetQuaCardProps> = ({ phieu, editable = false, onChange }) => {
  const update = (field: keyof PhieuNhanXetInput, value: string) => {
    onChange?.({ [field]: value });
  };

  return (
    <article className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
      <div className="bg-indigo-700 text-white px-6 py-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-100">Phiếu kết quả học tập</p>
        <h3 className="text-2xl font-black mt-1">{phieu.student_name}</h3>
        <p className="text-sm text-indigo-100 mt-1">{phieu.ten_bai_tap || 'Bài tập'} • {phieu.mon_hoc || 'Môn học'}</p>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Điểm số" value={`${Number(phieu.diem_so || 0).toFixed(1)}/10`} />
          <Metric label="Xếp loại" value={phieu.xep_loai || 'Trung bình'} />
          <Metric label="Số câu đúng" value={String(phieu.so_cau_dung || 0)} />
          <Metric label="Số câu sai" value={String(phieu.so_cau_sai || 0)} />
        </div>

        <EditableBlock
          label="Nhận xét"
          value={phieu.nhan_xet || ''}
          editable={editable}
          onChange={(value) => update('nhan_xet', value)}
        />
        <EditableBlock
          label="Cần cố gắng"
          value={phieu.noi_dung_co_gang || ''}
          editable={editable}
          onChange={(value) => update('noi_dung_co_gang', value)}
        />
        <EditableBlock
          label="Lời động viên"
          value={phieu.loi_dong_vien || ''}
          editable={editable}
          onChange={(value) => update('loi_dong_vien', value)}
        />
      </div>
    </article>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="text-lg font-black text-slate-800 mt-1">{value}</p>
  </div>
);

const EditableBlock: React.FC<{
  label: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, editable, onChange }) => (
  <section>
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
    {editable ? (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
      />
    ) : (
      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    )}
  </section>
);
