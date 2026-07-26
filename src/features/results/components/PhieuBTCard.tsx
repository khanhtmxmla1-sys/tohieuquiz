/**
 * PhieuBTCard — Mẫu phiếu kết quả bài tập kiểm tra (Quiz)
 * Bố cục: tiêu đề → thông tin HS → kết quả số →
 *          nhận xét GV → cần cố gắng → lời động viên → chữ ký GVCN.
 *
 * Props:
 *   phieu    — dữ liệu phiếu (PhieuNhanXet | PhieuNhanXetInput)
 *   editable — cho phép chỉnh sửa các ô nhận xét (default: false)
 *   onChange — callback khi chỉnh sửa
 *   tenGVCN  — tên giáo viên chủ nhiệm hiển thị cuối phiếu
 *
 * @blueprint senior-engineering-toolkit
 */

import React from 'react';
import { PhieuNhanXet, PhieuNhanXetInput } from '../../homework/types/phieu.types';
import { formatPhieuDate, formatPhieuScore } from '../utils/phieuFormat';

interface Props {
  phieu: PhieuNhanXet | PhieuNhanXetInput;
  editable?: boolean;
  editableIdentity?: boolean;
  onChange?: (patch: Partial<PhieuNhanXetInput>) => void;
  tenGVCN?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const dotLine = (val?: string | number) =>
  val != null && val !== ''
    ? String(val)
    : '..........................................';

function scoreColor(score: number) {
  if (score >= 9)   return { bg: '#dcfce7', border: '#22c55e', text: '#15803d' };
  if (score >= 8)   return { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' };
  if (score >= 6.5) return { bg: '#fef9c3', border: '#eab308', text: '#854d0e' };
  if (score >= 5)   return { bg: '#ffedd5', border: '#f97316', text: '#c2410c' };
  return             { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' };
}

// ── Sub-components ────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value?: string | number; bold?: boolean }> = ({
  label, value, bold,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 8, fontSize: 13 }}>
    <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', minWidth: 130, flexShrink: 0 }}>
      {label}:
    </span>
    <span
      style={{
        flex: 1,
        borderBottom: '1.5px solid #94a3b8',
        paddingBottom: 1,
        fontWeight: bold ? 800 : 600,
        color: '#1e293b',
        minWidth: 0,
        wordBreak: 'break-word',
      }}
    >
      {dotLine(value)}
    </span>
  </div>
);

// Editable version of InfoRow — renders an input instead of a static span
const EditableInfoRow: React.FC<{
  label: string; value: string; onChange: (v: string) => void; bold?: boolean;
}> = ({ label, value, onChange, bold }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
    <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', minWidth: 130, flexShrink: 0 }}>
      {label}:
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1,
        border: 'none',
        borderBottom: '1.5px solid #3b82f6',
        background: 'transparent',
        fontSize: 13,
        fontWeight: bold ? 800 : 600,
        color: '#1e293b',
        outline: 'none',
        padding: '1px 2px',
        minWidth: 0,
      }}
    />
  </div>
);

// Editable compact version for short labels (e.g. "Lớp")
const EditableInfoRowCompact: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, fontSize: 13 }}>
    <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}:
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1,
        border: 'none',
        borderBottom: '1.5px solid #3b82f6',
        background: 'transparent',
        fontSize: 13,
        fontWeight: 600,
        color: '#1e293b',
        outline: 'none',
        padding: '1px 2px',
        minWidth: 0,
      }}
    />
  </div>
);

// Compact version for short labels (e.g. "Lớp") — no fixed minWidth
const InfoRowCompact: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 8, fontSize: 13 }}>
    <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}:
    </span>
    <span
      style={{
        flex: 1,
        borderBottom: '1.5px solid #94a3b8',
        paddingBottom: 1,
        fontWeight: 600,
        color: '#1e293b',
        minWidth: 0,
        wordBreak: 'break-word',
      }}
    >
      {dotLine(value)}
    </span>
  </div>
);

const StatBox: React.FC<{
  label: string; value: string;
  bg: string; border: string; textColor: string;
}> = ({ label, value, bg, border, textColor }) => (
  <div
    style={{
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: 12,
      textAlign: 'center',
      padding: '10px 4px',
      flex: 1,
    }}
  >
    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', lineHeight: 1.3, marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 900, color: textColor }}>{value}</div>
  </div>
);

const SectionTitle: React.FC<{ text: string; color: string; bg: string; border: string }> = ({
  text, color, bg, border,
}) => (
  <div
    style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 10,
      padding: '5px 14px',
      fontWeight: 900,
      fontSize: 11,
      color,
      letterSpacing: 1,
      marginBottom: 8,
    }}
  >
    {text}
  </div>
);

const EditBlock: React.FC<{
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
}> = ({ value, editable, onChange, rows = 3, placeholder = '', ariaLabel }) => {
  if (editable) {
    return (
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          border: '1.5px solid #bfdbfe',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 13,
          color: '#1e293b',
          resize: 'vertical',
          outline: 'none',
          background: '#f8fafc',
          fontFamily: 'inherit',
          lineHeight: 1.6,
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <p
      style={{
        fontSize: 13,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        margin: 0,
        minHeight: rows * 20,
        fontStyle: value ? 'normal' : 'italic',
        color: value ? '#1e293b' : '#94a3b8',
      } as React.CSSProperties}
    >
      {value || placeholder}
    </p>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const PhieuBTCard: React.FC<Props> = ({
  phieu,
  editable = false,
  editableIdentity = true,
  onChange,
  tenGVCN = '',
}) => {
  const update = (field: keyof PhieuNhanXetInput, val: string) => onChange?.({ [field]: val });
  const canEditIdentity = editable && editableIdentity;

  const score   = Number(phieu.diem_so    ?? 0);
  const tongCau = Number(phieu.tong_cau   ?? 0);
  const caudung = Number(phieu.so_cau_dung ?? 0);
  const causai  = Number(phieu.so_cau_sai  ?? 0);
  const sc      = scoreColor(score);
  const ngay    = formatPhieuDate(phieu.ngay_lam_bai, '..........................................');

  return (
    <article
      style={{
        fontFamily: "'Segoe UI', 'Nunito', sans-serif",
        background: '#fff',
        border: '2.5px solid #7dd3fc',
        borderRadius: 20,
        overflow: 'hidden',
        maxWidth: 520,
        boxShadow: '0 6px 32px rgba(56,189,248,0.15)',
        pageBreakInside: 'avoid',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: 'linear-gradient(90deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%)',
          padding: '18px 24px 14px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: 2,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          🎓 PHIẾU KẾT QUẢ BÀI TẬP KIỂM TRA
        </h2>
      </div>

      {/* ── THÔNG TIN HỌC SINH ── */}
      <div
        style={{
          background: '#eff6ff',
          borderBottom: '2px solid #bfdbfe',
          padding: '14px 24px 10px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: '#2563eb',
            letterSpacing: 2,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          ▸ Thông tin học sinh
        </div>

        {/* Họ tên + Lớp cùng hàng */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 2 }}>
            {canEditIdentity ? (
              <EditableInfoRow
                label="Họ và tên"
                value={phieu.student_name ?? ''}
                onChange={(v) => update('student_name', v)}
                bold
              />
            ) : (
              <InfoRow label="Họ và tên" value={phieu.student_name} bold />
            )}
          </div>
          <div style={{ flex: 1 }}>
            {canEditIdentity ? (
              <EditableInfoRowCompact
                label="Lớp"
                value={phieu.class_id ?? ''}
                onChange={(v) => update('class_id', v)}
              />
            ) : (
              <InfoRowCompact label="Lớp" value={phieu.class_id} />
            )}
          </div>
        </div>

        {canEditIdentity ? (
          <EditableInfoRow
            label="Môn học"
            value={phieu.mon_hoc ?? ''}
            onChange={(v) => update('mon_hoc', v)}
          />
        ) : (
          <InfoRow label="Môn học" value={phieu.mon_hoc} />
        )}
        <InfoRow label="Tên bài kiểm tra" value={phieu.ten_bai_tap} />
        <InfoRow label="Ngày làm bài"     value={ngay}              />
      </div>

      {/* ── KẾT QUẢ ── */}
      <div style={{ padding: '14px 24px 4px' }}>
        <SectionTitle
          text="📊  KẾT QUẢ BÀI LÀM"
          color="#1d4ed8" bg="#dbeafe" border="#93c5fd"
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox
            label="Tổng số câu"
            value={tongCau > 0 ? String(tongCau) : '—'}
            bg="#f1f5f9" border="#94a3b8" textColor="#1e293b"
          />
          <StatBox
            label="Số câu đúng"
            value={String(caudung)}
            bg="#dcfce7" border="#86efac" textColor="#15803d"
          />
          <StatBox
            label="Số câu sai"
            value={String(causai)}
            bg="#fee2e2" border="#fca5a5" textColor="#b91c1c"
          />
          <StatBox
            label="Điểm số"
            value={formatPhieuScore(phieu.diem_so, '—')}
            bg={sc.bg} border={sc.border} textColor={sc.text}
          />
          <StatBox
            label="Xếp loại"
            value={phieu.xep_loai || '—'}
            bg={sc.bg} border={sc.border} textColor={sc.text}
          />
        </div>
      </div>

      {/* ── NHẬN XÉT CỦA GIÁO VIÊN ── */}
      <div style={{ padding: '12px 24px 4px' }}>
        <SectionTitle
          text="💬  NHẬN XÉT CỦA GIÁO VIÊN"
          color="#1e40af" bg="#eff6ff" border="#93c5fd"
        />
        <EditBlock
          value={phieu.nhan_xet || ''}
          editable={editable}
          onChange={(v) => update('nhan_xet', v)}
          rows={3}
          ariaLabel="Nhận xét"
          placeholder="(Chưa có nhận xét)"
        />
      </div>

      {/* ── NỘI DUNG CẦN CỐ GẮNG ── */}
      <div style={{ padding: '12px 24px 4px' }}>
        <SectionTitle
          text="🎯  NỘI DUNG CẦN CỐ GẮNG THÊM"
          color="#15803d" bg="#f0fdf4" border="#86efac"
        />
        <EditBlock
          value={phieu.noi_dung_co_gang || ''}
          editable={editable}
          onChange={(v) => update('noi_dung_co_gang', v)}
          rows={2}
          ariaLabel="Cần cố gắng"
          placeholder="(Chưa có nội dung)"
        />
      </div>

      {/* ── LỜI ĐỘNG VIÊN ── */}
      <div style={{ padding: '12px 24px 8px' }}>
        <SectionTitle
          text="⭐  LỜI ĐỘNG VIÊN"
          color="#92400e" bg="#fffbeb" border="#fde68a"
        />
        <EditBlock
          value={phieu.loi_dong_vien || ''}
          editable={editable}
          onChange={(v) => update('loi_dong_vien', v)}
          rows={2}
          ariaLabel="Lời động viên"
          placeholder="(Chưa có lời động viên)"
        />
      </div>

      {/* ── FOOTER: CHỮ KÝ GVCN ── */}
      <div
        style={{
          borderTop: '2px dashed #bfdbfe',
          margin: '12px 24px 0',
          paddingTop: 14,
          paddingBottom: 20,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <div style={{ textAlign: 'center', minWidth: 180 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '0 0 4px' }}>
            Giáo viên chủ nhiệm
          </p>
          {/* Vùng ký tay khi in */}
          <div style={{ height: 52, borderBottom: '1.5px solid #94a3b8', marginBottom: 6 }} />
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              margin: 0,
              fontStyle: tenGVCN ? 'normal' : 'italic',
              color: tenGVCN ? '#1e293b' : '#94a3b8',
            } as React.CSSProperties}
          >
            {tenGVCN || '(Họ tên GVCN)'}
          </p>
        </div>
      </div>
    </article>
  );
};

export default PhieuBTCard;
