import type { QuestionBankPagination as Pagination } from '../questionBank.types';

interface QuestionBankPaginationProps {
  value: Pagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export const QuestionBankPagination = ({ value, onPageChange, onPageSizeChange }: QuestionBankPaginationProps) => {
  const totalPages = Math.max(1, value.totalPages);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>{value.totalItems} câu hỏi · Trang {value.page}/{totalPages}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select aria-label="Số câu mỗi trang" value={value.pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-11 rounded-lg border border-slate-200 bg-white px-3">
            {[30, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <button type="button" disabled={value.page <= 1} onClick={() => onPageChange(value.page - 1)} className="min-h-11 rounded-lg border border-slate-200 px-4 font-semibold disabled:opacity-40">Trang trước</button>
        <button type="button" disabled={value.page >= totalPages} onClick={() => onPageChange(value.page + 1)} className="min-h-11 rounded-lg border border-slate-200 px-4 font-semibold disabled:opacity-40">Trang sau</button>
      </div>
    </div>
  );
};
