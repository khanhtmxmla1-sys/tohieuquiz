/**
 * PhieuPrintView - Component in phiếu kết quả làm bài tập
 * Layout khớp mẫu phiếu thiết kế sẵn, chuẩn A4 khi in.
 *
 * @blueprint senior-engineering-toolkit
 */

import React, { useCallback } from 'react';
import { PhieuNhanXet, PhieuNhanXetInput } from '../../homework/types/phieu.types';
import { formatPhieuDate, formatPhieuScore } from '../utils/phieuFormat';

interface Props {
  phieu: PhieuNhanXet | PhieuNhanXetInput;
  /** Nếu true, render nút "In phiếu" ở góc trên phải */
  showPrintButton?: boolean;
}

const PhieuPrintView: React.FC<Props> = ({ phieu, showPrintButton = true }) => {
  const tongCau = Number(phieu.tong_cau  ?? 0);
  const caudung = Number(phieu.so_cau_dung ?? 0);
  const causai  = Number(phieu.so_cau_sai  ?? 0);

  const ngayFormatted = formatPhieuDate(phieu.ngay_lam_bai, '...............');

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      {/* ── CSS print + font ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

        .phieu-print-root {
          font-family: 'Nunito', 'Segoe UI', sans-serif;
          background: #f0f8ff;
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px;
        }

        .phieu-a4 {
          background: #ffffff;
          border-radius: 24px;
          border: 3px solid #7dd3fc;
          box-shadow: 0 6px 32px rgba(56,189,248,0.18);
          width: 480px;
          padding: 0 0 24px;
          position: relative;
          overflow: hidden;
        }

        /* ── Header banner ── */
        .phieu-header {
          background: linear-gradient(90deg,#e0f2fe 0%,#bae6fd 50%,#e0f2fe 100%);
          border-bottom: 2px solid #7dd3fc;
          padding: 18px 24px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .phieu-header-icon {
          font-size: 36px;
          flex-shrink: 0;
        }
        .phieu-header-text {
          font-size: 20px;
          font-weight: 900;
          color: #1e40af;
          letter-spacing: 1.5px;
          text-align: center;
          flex: 1;
        }

        /* ── Medal decoration ── */
        .phieu-medal {
          position: absolute;
          top: 14px;
          right: 18px;
          width: 56px;
          height: 56px;
          background: radial-gradient(circle,#fde68a 60%,#f59e0b 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 2px 8px rgba(245,158,11,0.4);
          border: 3px solid #f59e0b;
        }
        .phieu-medal::after {
          content: '';
          position: absolute;
          bottom: -14px;
          left: 50%;
          transform: translateX(-50%);
          width: 18px;
          height: 18px;
          background: #2563eb;
          border-radius: 3px;
          border: 2px solid #1d4ed8;
        }

        /* ── Info rows ── */
        .phieu-info-block {
          padding: 16px 24px 8px;
        }
        .phieu-info-row {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .phieu-info-icon { font-size: 16px; flex-shrink: 0; }
        .phieu-info-label { font-weight: 700; color: #475569; white-space: nowrap; }
        .phieu-info-dots {
          flex: 1;
          border-bottom: 1.5px dotted #94a3b8;
          margin-bottom: 2px;
        }
        .phieu-info-value { font-weight: 700; color: #1e293b; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }

        /* ── KQ section title ── */
        .phieu-kq-title {
          margin: 4px 24px 10px;
          background: #dbeafe;
          border: 1.5px solid #93c5fd;
          border-radius: 12px;
          text-align: center;
          padding: 5px 0;
          font-size: 12px;
          font-weight: 900;
          color: #1d4ed8;
          letter-spacing: 1px;
        }

        /* ── Result boxes ── */
        .phieu-result-grid {
          display: grid;
          grid-template-columns: repeat(5,1fr);
          gap: 8px;
          padding: 0 24px 12px;
        }
        .phieu-result-box {
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 10px 4px 8px;
          text-align: center;
          min-height: 80px;
        }
        .phieu-result-box-icon  { font-size: 20px; margin-bottom: 4px; }
        .phieu-result-box-label { font-size: 9px; font-weight: 700; color: #475569; line-height: 1.2; }
        .phieu-result-box-val   { font-size: 18px; font-weight: 900; color: #1e293b; margin-top: 4px; }

        /* ── Edit sections ── */
        .phieu-section {
          margin: 0 24px 10px;
        }
        .phieu-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: 10px;
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.8px;
          margin-bottom: 6px;
        }
        .phieu-section-lines {
          min-height: 48px;
          background: transparent;
        }
        .phieu-section-line {
          border-bottom: 1px solid #e2e8f0;
          height: 22px;
          margin-bottom: 0;
        }
        .phieu-section-text {
          font-size: 12.5px;
          color: #334155;
          line-height: 1.8;
          padding: 0 4px;
          white-space: pre-wrap;
        }

        /* ── Print button (screen only) ── */
        .phieu-print-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          margin: 0 auto 16px;
          box-shadow: 0 2px 8px rgba(37,99,235,0.3);
          transition: background 0.2s;
        }
        .phieu-print-btn:hover { background: #1d4ed8; }

        /* ── @media print ── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          body * { visibility: hidden !important; }
          .phieu-print-root,
          .phieu-print-root * { visibility: visible !important; }
          .phieu-print-root {
            position: absolute;
            inset: 0;
            background: #fff !important;
            padding: 0 !important;
            display: block;
          }
          .phieu-a4 {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: 2px solid #7dd3fc !important;
            border-radius: 12px !important;
            break-inside: avoid;
          }
          .phieu-print-btn { display: none !important; }
          .phieu-medal { display: none !important; }
        }
      `}</style>

      <div className="phieu-print-root">
        {/* Nút in — chỉ hiển thị trên màn hình */}
        {showPrintButton && (
          <button className="phieu-print-btn" onClick={handlePrint}>
            🖨️ In phiếu
          </button>
        )}

        <div className="phieu-a4">
          {/* Medal trang trí */}
          <div className="phieu-medal">⭐</div>

          {/* Header */}
          <div className="phieu-header">
            <span className="phieu-header-icon">🎓</span>
            <h1 className="phieu-header-text">PHIẾU KẾT QUẢ LÀM BÀI TẬP</h1>
          </div>

          {/* Thông tin học sinh */}
          <div className="phieu-info-block">
            <InfoRow icon="👤" label="Họ và tên học sinh" value={phieu.student_name} />
            <InfoRow icon="🏫" label="Lớp"                value={phieu.class_id || ''} />
            <InfoRow icon="📚" label="Môn học"            value={phieu.mon_hoc  || ''} />
            <InfoRow icon="✏️" label="Tên bài tập"        value={phieu.ten_bai_tap || ''} />
            <InfoRow icon="📅" label="Ngày làm bài"       value={ngayFormatted} />
          </div>

          {/* Kết quả bài làm */}
          <div className="phieu-kq-title">KẾT QUẢ BÀI LÀM</div>
          <div className="phieu-result-grid">
            <ResultBox
              icon="📋" label="Tổng số câu"
              value={tongCau > 0 ? String(tongCau) : ''}
              bg="#dbeafe" border="#93c5fd"
            />
            <ResultBox
              icon="✅" label="Số câu đúng"
              value={String(caudung)}
              bg="#dcfce7" border="#86efac"
            />
            <ResultBox
              icon="❌" label="Số câu sai"
              value={String(causai)}
              bg="#fee2e2" border="#fca5a5"
            />
            <ResultBox
              icon="⭐" label="Điểm số"
              value={formatPhieuScore(phieu.diem_so, '')}
              bg="#fef9c3" border="#fde047"
            />
            <ResultBox
              icon="🏆" label="Xếp loại"
              value={phieu.xep_loai || ''}
              bg="#fef3c7" border="#fcd34d"
            />
          </div>

          {/* Nhận xét giáo viên */}
          <Section
            icon="💬" label="NHẬN XÉT CỦA GIÁO VIÊN"
            labelColor="#1e40af" bg="#eff6ff" border="#93c5fd"
            text={phieu.nhan_xet || ''}
            lines={3}
          />

          {/* Cần cố gắng */}
          <Section
            icon="🎯" label="NỘI DUNG CẦN CỐ GẮNG THÊM"
            labelColor="#15803d" bg="#f0fdf4" border="#86efac"
            text={phieu.noi_dung_co_gang || ''}
            lines={2}
          />

          {/* Lời động viên */}
          <Section
            icon="⭐" label="LỜI ĐỘNG VIÊN"
            labelColor="#92400e" bg="#fffbeb" border="#fde68a"
            text={phieu.loi_dong_vien || ''}
            lines={2}
          />
        </div>
      </div>
    </>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="phieu-info-row">
    <span className="phieu-info-icon">{icon}</span>
    <span className="phieu-info-label">{label}</span>
    <span className="phieu-info-dots" />
    <span className="phieu-info-value">{value || '...............'}</span>
  </div>
);

const ResultBox: React.FC<{ icon: string; label: string; value: string; bg: string; border: string }> = (
  { icon, label, value, bg, border }
) => (
  <div
    className="phieu-result-box"
    style={{ background: bg, border: `1.5px dashed ${border}` }}
  >
    <span className="phieu-result-box-icon">{icon}</span>
    <span className="phieu-result-box-label">{label}</span>
    <span className="phieu-result-box-val">{value || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
  </div>
);

const Section: React.FC<{
  icon: string; label: string;
  labelColor: string; bg: string; border: string;
  text: string; lines: number;
}> = ({ icon, label, labelColor, bg, border, text, lines }) => (
  <div className="phieu-section">
    <div
      className="phieu-section-header"
      style={{ background: bg, border: `1.5px solid ${border}`, color: labelColor }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    {text ? (
      <p className="phieu-section-text">{text}</p>
    ) : (
      <div className="phieu-section-lines">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="phieu-section-line" />
        ))}
      </div>
    )}
  </div>
);

export default PhieuPrintView;
