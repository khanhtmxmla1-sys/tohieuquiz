import { FileJson, Upload } from 'lucide-react';
import { useState } from 'react';
import type {
  BulkImportResult,
  CreateQuestionBankItemInput,
} from '../questionBank.types';
import { BulkImportReviewTable } from './BulkImportReviewTable';

interface BulkQuestionImportPanelProps {
  onImport: (items: CreateQuestionBankItemInput[]) => Promise<BulkImportResult>;
  onImported?: () => void;
}

const readFileText = (file: File): Promise<string> => {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc file JSON.'));
    reader.readAsText(file);
  });
};

const normalizeInput = (value: unknown): CreateQuestionBankItemInput[] => {
  if (!Array.isArray(value)) throw new Error('File JSON phải chứa một mảng câu hỏi.');
  if (value.length === 0) throw new Error('File JSON không có câu hỏi.');
  if (value.length > 100) throw new Error('Mỗi lần chỉ được nhập tối đa 100 câu.');
  return value.map((entry) => ({
    ...(entry && typeof entry === 'object' ? entry as CreateQuestionBankItemInput : {} as CreateQuestionBankItemInput),
    scope: 'SYSTEM',
    status: (entry as CreateQuestionBankItemInput | null)?.status || 'DRAFT',
  }));
};

export const BulkQuestionImportPanel = ({ onImport, onImported }: BulkQuestionImportPanelProps) => {
  const [items, setItems] = useState<CreateQuestionBankItemInput[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const readFile = async (file?: File) => {
    setItems([]);
    setResult(null);
    setError('');
    setFileName(file?.name || '');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Chỉ hỗ trợ file JSON trong phiên bản này.');
      return;
    }
    try {
      const parsed = JSON.parse(await readFileText(file)) as unknown;
      setItems(normalizeInput(parsed));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Không thể đọc file JSON.');
    }
  };

  const submit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const nextResult = await onImport(items);
      setResult(nextResult);
      onImported?.();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Không thể nhập câu hỏi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="bulk-question-import-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700"><FileJson className="h-5 w-5" /></span>
        <div>
          <h2 id="bulk-question-import-title" className="font-semibold text-slate-900">Nhập câu hỏi bằng JSON</h2>
          <p className="mt-1 text-sm text-slate-600">Mỗi lần tối đa 100 câu; dữ liệu được tạo dưới trạng thái bản nháp nếu chưa chỉ định.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Upload className="h-4 w-4" /> Chọn file JSON
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Chọn file JSON câu hỏi"
            className="sr-only"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
        </label>
        {fileName && <span className="truncate text-sm text-slate-600">{fileName}</span>}
        <button
          type="button"
          disabled={items.length === 0 || submitting}
          onClick={() => void submit()}
          className="min-h-11 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
        >
          {submitting ? 'Đang nhập…' : `Nhập ${items.length} câu vào bản nháp`}
        </button>
      </div>

      {items.length > 0 && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Sẵn sàng nhập {items.length} câu</p>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      <BulkImportReviewTable result={result} />
    </section>
  );
};
