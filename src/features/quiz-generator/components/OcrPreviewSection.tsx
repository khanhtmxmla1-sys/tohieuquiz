import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import type { OcrDocument } from '../../../services/ai/schemas/ocrDocumentSchema';

interface OcrPreviewSectionProps {
  document: OcrDocument;
  selectedPageNumbers: number[];
  onChange: (pageNumbers: number[]) => void;
}

const OcrPreviewSection: React.FC<OcrPreviewSectionProps> = ({
  document,
  selectedPageNumbers,
  onChange,
}) => {
  const selected = new Set(selectedPageNumbers);

  const togglePage = (pageNumber: number) => {
    const next = selected.has(pageNumber)
      ? selectedPageNumbers.filter((value) => value !== pageNumber)
      : [...selectedPageNumbers, pageNumber].sort((left, right) => left - right);
    onChange(next);
  };

  return (
    <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-5 w-5 text-blue-700" />
          <div>
            <h3 className="font-bold text-blue-900">Xem trước nội dung OCR</h3>
            <p className="text-xs text-blue-700">
              Đã chọn {selectedPageNumbers.length}/{document.pages.length} trang. Chỉ các trang được chọn mới dùng để tạo đề.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(document.pages.map((page) => page.pageNumber))}
            className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            Bỏ chọn
          </button>
        </div>
      </div>

      {document.wasTruncated && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Tài liệu đã bị cắt bớt
        </div>
      )}

      {document.warnings.map((warning) => (
        <p key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warning}
        </p>
      ))}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {document.pages.map((page) => {
          const checked = selected.has(page.pageNumber);
          return (
            <label
              key={page.pageNumber}
              className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${
                checked
                  ? 'border-blue-500 bg-white'
                  : 'border-gray-200 bg-gray-50 opacity-70 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Trang ${page.pageNumber}`}
                  checked={checked}
                  onChange={() => togglePage(page.pageNumber)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-gray-800">Trang {page.pageNumber}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-gray-600">
                {page.text.slice(0, 220)}{page.text.length > 220 ? '…' : ''}
              </p>
            </label>
          );
        })}
      </div>

      {selectedPageNumbers.length === 0 && (
        <p role="alert" className="text-sm font-bold text-red-700">Cần chọn ít nhất một trang.</p>
      )}
    </section>
  );
};

export default OcrPreviewSection;
