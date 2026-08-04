import { formatSystemDate } from '../../utils/dateTime';
import { Archive, BookOpenCheck, FileClock, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { testBankService } from '../../services/testBankService';
import { showError, showSuccess } from '../../utils/toast';
import { BulkQuestionImportPanel } from './components/BulkQuestionImportPanel';
import { QuestionBankFilters } from './components/QuestionBankFilters';
import { QuestionBankPagination } from './components/QuestionBankPagination';
import type {
  BulkImportResult,
  CreateQuestionBankItemInput,
  QuestionBankFilters as Filters,
  QuestionBankStatus,
} from './questionBank.types';
import { useQuestionBank } from './useQuestionBank';

const STATUS_CARDS: Array<{
  status: QuestionBankStatus;
  label: string;
  description: string;
  icon: typeof FileClock;
}> = [
  { status: 'DRAFT', label: 'Bản nháp', description: 'Đang chờ kiểm tra', icon: FileClock },
  { status: 'PUBLISHED', label: 'Đã phát hành', description: 'Giáo viên có thể sử dụng', icon: BookOpenCheck },
  { status: 'ARCHIVED', label: 'Đã lưu trữ', description: 'Không còn hiển thị', icon: Archive },
];

const initialFilters: Filters = {
  scope: 'SYSTEM',
  status: 'DRAFT',
  search: '',
  page: 1,
  pageSize: 30,
};

const formatDate = (value: string) => formatSystemDate(value, value);

const SystemQuestionBankAdminPage = () => {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [counts, setCounts] = useState<Record<QuestionBankStatus, number>>({ DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 });
  const [countLoading, setCountLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const bank = useQuestionBank(filters, true);

  const loadCounts = useCallback(async () => {
    setCountLoading(true);
    try {
      const results = await Promise.all(STATUS_CARDS.map(({ status }) => (
        testBankService.listQuestionBank({ scope: 'SYSTEM', status, page: 1, pageSize: 1 })
      )));
      setCounts({
        DRAFT: results[0].pagination.totalItems,
        PUBLISHED: results[1].pagination.totalItems,
        ARCHIVED: results[2].pagination.totalItems,
      });
    } catch {
      showError('Không thể tải thống kê ngân hàng câu hỏi.');
    } finally {
      setCountLoading(false);
    }
  }, []);

  useEffect(() => { void loadCounts(); }, [loadCounts]);

  const publish = async (id: string) => {
    setMutatingId(id);
    try {
      await testBankService.patchQuestionBankItem(id, { status: 'PUBLISHED' });
      showSuccess('Đã phát hành câu hỏi.');
      bank.reload();
      await loadCounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể phát hành câu hỏi.');
    } finally {
      setMutatingId(null);
    }
  };

  const archive = async (id: string) => {
    setMutatingId(id);
    try {
      await testBankService.archiveQuestionBankItem(id);
      showSuccess('Đã lưu trữ câu hỏi.');
      bank.reload();
      await loadCounts();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể lưu trữ câu hỏi.');
    } finally {
      setMutatingId(null);
    }
  };

  const bulkImport = async (items: CreateQuestionBankItemInput[]): Promise<BulkImportResult> => {
    const result = await testBankService.bulkImportQuestionBank(items);
    showSuccess(`Đã tạo ${result.summary.created} câu hỏi bản nháp.`);
    return result;
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Ngân hàng câu hỏi hệ thống</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Kiểm tra, phân loại và phát hành câu hỏi dùng chung cho toàn bộ giáo viên.</p>
          </div>
        </div>
        <button type="button" onClick={() => { bank.reload(); void loadCounts(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </button>
      </header>

      <section aria-label="Thống kê trạng thái câu hỏi" className="grid gap-3 sm:grid-cols-3">
        {STATUS_CARDS.map(({ status, label, description, icon: Icon }) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, status, page: 1 }))}
            className={`min-h-28 rounded-xl border bg-white p-4 text-left transition hover:border-sky-300 ${filters.status === status ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span>
              <span className="text-2xl font-semibold text-slate-900">{countLoading ? '—' : counts[status]}</span>
            </div>
            <p className="mt-3 font-semibold text-slate-900">{label}</p>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </button>
        ))}
      </section>

      <BulkQuestionImportPanel
        onImport={bulkImport}
        onImported={() => {
          bank.reload();
          void loadCounts();
        }}
      />

      <section aria-labelledby="system-bank-list-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="system-bank-list-title" className="font-semibold text-slate-900">Danh sách câu hỏi</h2>
            <p className="mt-1 text-sm text-slate-600">Trạng thái hiện tại: {filters.status || 'Tất cả'}</p>
          </div>
        </div>

        <QuestionBankFilters value={filters} onChange={(next) => setFilters({ ...next, scope: 'SYSTEM' })} showStatus />

        {bank.error ? (
          <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {bank.error}
            <button type="button" onClick={bank.reload} className="ml-3 font-semibold underline">Thử lại</button>
          </div>
        ) : bank.loading ? (
          <div role="status" aria-busy="true" className="grid min-h-48 place-items-center text-sm text-slate-500">Đang tải danh sách câu hỏi…</div>
        ) : bank.items.length === 0 ? (
          <div role="status" className="grid min-h-48 place-items-center px-4 text-center text-sm text-slate-500">Không có câu hỏi phù hợp với bộ lọc.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Câu hỏi</th>
                  <th className="px-4 py-3">Phân loại</th>
                  <th className="px-4 py-3">Cập nhật</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bank.items.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-xl px-4 py-4 align-top">
                      <p className="line-clamp-2 font-medium text-slate-900">{item.questionText}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.questionType} · Mức {item.difficulty || '—'} · {item.status}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-slate-600">
                      <p>{item.metadata.grade ? `Lớp ${item.metadata.grade}` : 'Chưa gán lớp'} · {item.metadata.subject || 'Chưa gán môn'}</p>
                      <p className="mt-1 text-xs">{item.metadata.topicCode || '—'} · {item.metadata.lessonCode || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-slate-600">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {item.status !== 'PUBLISHED' && item.status !== 'ARCHIVED' && (
                          <button type="button" disabled={mutatingId === item.id} onClick={() => void publish(item.id)} className="min-h-11 rounded-lg bg-sky-600 px-3 font-semibold text-white disabled:opacity-50">Phát hành</button>
                        )}
                        {item.status !== 'ARCHIVED' && (
                          <button type="button" disabled={mutatingId === item.id} onClick={() => void archive(item.id)} className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 disabled:opacity-50">Lưu trữ</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <QuestionBankPagination
          value={bank.pagination}
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))}
        />
      </section>
    </div>
  );
};

export default SystemQuestionBankAdminPage;
