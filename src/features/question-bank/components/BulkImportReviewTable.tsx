import type { BulkImportResult } from '../questionBank.types';

interface BulkImportReviewTableProps {
  result: BulkImportResult | null;
}

export const BulkImportReviewTable = ({ result }: BulkImportReviewTableProps) => {
  if (!result) return null;

  return (
    <section aria-labelledby="bulk-import-result-title" className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 id="bulk-import-result-title" className="font-semibold text-slate-900">Kết quả nhập dữ liệu</h3>
        <p className="mt-1 text-sm text-slate-600">
          {result.summary.created} đã tạo · {result.summary.duplicates} trùng · {result.summary.invalid} không hợp lệ
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Dòng</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Chi tiết</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.results.map((entry) => (
              <tr key={entry.index}>
                <td className="px-4 py-3">{entry.index + 1}</td>
                <td className="px-4 py-3 font-semibold">{entry.status}</td>
                <td className="px-4 py-3 text-slate-600">
                  {entry.status === 'CREATED' && entry.id}
                  {entry.status === 'DUPLICATE' && `Đã tồn tại: ${entry.existingId}`}
                  {entry.status === 'INVALID' && entry.errors.join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
