import React, { useRef, useState } from 'react';
import { Braces, Clipboard, FileSpreadsheet, RotateCcw, Trash2, X } from 'lucide-react';
import QuestionImportReview from '../import/QuestionImportReview';
import { QUESTION_JSON_EXAMPLE, parseQuestionJsonText } from '../import/jsonQuestionImporter';
import type { QuestionImportResult } from '../import/questionImport.types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

type DocxImporterModule = typeof import('../import/docxQuestionImporter');
let docxImporterPromise: Promise<DocxImporterModule> | null = null;
const loadQuestionImporter = (): Promise<DocxImporterModule> => {
    docxImporterPromise ??= import('../import/docxQuestionImporter');
    return docxImporterPromise;
};
export const preloadQuestionImporter = (): void => { void loadQuestionImporter(); };

type ImportSource = 'file' | 'json';

interface QuestionImportDrawerProps {
    open: boolean;
    onClose: () => void;
}

const QuestionImportDrawer: React.FC<QuestionImportDrawerProps> = ({ open, onClose }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [source, setSource] = useState<ImportSource>('file');
    const [result, setResult] = useState<QuestionImportResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [jsonText, setJsonText] = useState('');
    const [copyStatus, setCopyStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastAddedIds, setLastAddedIds] = useState<string[]>([]);
    const addQuestions = useManualQuizWorkspaceStore((state) => state.addQuestions);
    const removeQuestions = useManualQuizWorkspaceStore((state) => state.removeQuestions);

    useDialogFocusTrap({
        open,
        containerRef: drawerRef,
        initialFocusRef: closeButtonRef,
        onEscape: onClose,
    });

    if (!open) return null;

    const selectSource = (nextSource: ImportSource) => {
        setSource(nextSource);
        setResult(null);
        setError(null);
        setLoading(false);
        setCopyStatus('');
    };

    const loadFile = async (file: File) => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !['csv', 'xlsx', 'docx'].includes(extension)) {
            setError('Chỉ hỗ trợ CSV, XLSX hoặc DOCX.');
            setResult(null);
            return;
        }
        setLoading(true);
        setError(null);
        setFileName(file.name);
        setLastAddedIds([]);
        try {
            const imported = extension === 'docx'
                ? await loadQuestionImporter().then((module) => module.importQuestionDocx(file))
                : await import('../import/spreadsheetQuestionImporter').then((module) => module.importQuestionSpreadsheet(file));
            setResult(imported);
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : 'Không thể đọc tệp câu hỏi.');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const checkJson = () => {
        setError(null);
        setResult(null);
        setLastAddedIds([]);
        try {
            setResult(parseQuestionJsonText(jsonText));
        } catch (parseError) {
            setError(parseError instanceof Error ? parseError.message : 'Không thể phân tích JSON.');
        }
    };

    const copyJsonExample = async () => {
        if (!navigator.clipboard?.writeText) {
            setCopyStatus('Trình duyệt chưa hỗ trợ sao chép tự động.');
            return;
        }
        try {
            await navigator.clipboard.writeText(QUESTION_JSON_EXAMPLE);
            setCopyStatus('Đã sao chép JSON mẫu.');
        } catch {
            setCopyStatus('Không thể sao chép tự động.');
        }
    };

    const importQuestions = (questions: ManualQuizQuestion[]) => {
        addQuestions(questions);
        setLastAddedIds(questions.map((question) => question.id));
    };

    const undoImport = () => {
        removeQuestions(lastAddedIds);
        setLastAddedIds([]);
    };

    const jsonTotal = result
        ? result.accepted.length + result.needsReview.length + result.rejected.length
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={onClose}>
            <section ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Nhập câu hỏi" onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>
                        <div><h2 className="text-xl font-semibold text-slate-900">Nhập câu hỏi</h2><p className="mt-1 text-sm text-slate-600">Tải CSV/XLSX/DOCX hoặc dán JSON để xem trước trước khi nhập.</p></div>
                    </div>
                    <button ref={closeButtonRef} type="button" aria-label="Đóng nhập câu hỏi" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>

                <div className="border-b border-slate-200 bg-slate-50 px-4 pt-4 lg:px-6">
                    <div role="tablist" aria-label="Nguồn nhập câu hỏi" className="flex gap-1">
                        <button type="button" role="tab" aria-selected={source === 'file'} onClick={() => selectSource('file')} className={`min-h-11 rounded-t-lg border px-4 text-sm font-semibold ${source === 'file' ? 'border-slate-200 border-b-white bg-white text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}><FileSpreadsheet className="mr-2 inline h-4 w-4" />Tải tệp</button>
                        <button type="button" role="tab" aria-selected={source === 'json'} onClick={() => selectSource('json')} className={`min-h-11 rounded-t-lg border px-4 text-sm font-semibold ${source === 'json' ? 'border-slate-200 border-b-white bg-white text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}><Braces className="mr-2 inline h-4 w-4" />Dán JSON</button>
                    </div>
                </div>

                {source === 'file' ? (
                    <div className="border-b border-slate-200 bg-white p-4 lg:px-6">
                        <input ref={inputRef} type="file" accept=".csv,.xlsx,.docx" aria-label="Chọn tệp câu hỏi" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
                        <div className="flex flex-wrap items-center gap-3">
                            <button type="button" onMouseEnter={preloadQuestionImporter} onFocus={preloadQuestionImporter} onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"><FileSpreadsheet className="h-4 w-4" /> Chọn tệp CSV, XLSX hoặc DOCX</button>
                            {fileName && <span className="min-w-0 truncate text-sm text-slate-600">{fileName}</span>}
                        </div>
                    </div>
                ) : (
                    <div className="border-b border-slate-200 bg-white p-4 lg:px-6">
                        <label className="block text-sm font-semibold text-slate-800">
                            Dữ liệu JSON
                            <textarea aria-label="Dữ liệu JSON" value={jsonText} onChange={(event) => { setJsonText(event.target.value); setError(null); setResult(null); }} spellCheck={false} placeholder={'{"questions":[{"type":"multiple_choice","question":"2 + 3 = ?","options":["4","5","6"],"answer":"5"}]}'} className="mt-2 min-h-52 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
                        </label>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => { setJsonText(''); setResult(null); setError(null); setCopyStatus(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Trash2 className="h-4 w-4" /> Xóa</button>
                                <button type="button" onClick={() => void copyJsonExample()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Clipboard className="h-4 w-4" /> Sao chép JSON mẫu</button>
                                <span aria-live="polite" className="text-xs text-slate-500">{copyStatus}</span>
                            </div>
                            <button type="button" disabled={!jsonText.trim()} onClick={checkJson} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"><Braces className="h-4 w-4" /> Kiểm tra JSON</button>
                        </div>
                    </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-6">
                    {loading && <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Đang phân tích tệp…</div>}
                    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
                    {!loading && !error && !result && <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm text-slate-500">{source === 'file' ? 'Chọn một tệp để xem trước các câu hỏi trước khi nhập.' : 'Dán JSON rồi chọn “Kiểm tra JSON” để xem trước các câu hỏi trước khi nhập.'}</div>}
                    {!loading && !error && source === 'json' && result && (
                        <div className="mb-5 flex flex-wrap gap-2 text-xs font-medium">
                            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{jsonTotal} câu</span>
                            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{result.accepted.length} sẵn sàng</span>
                            <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{result.needsReview.length} cần rà soát</span>
                            <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{result.rejected.length} không thể nhập</span>
                        </div>
                    )}
                    {!loading && result && <QuestionImportReview key={`${source}-${jsonTotal}-${result.accepted.length}-${result.needsReview.length}-${result.rejected.length}`} result={result} onImport={importQuestions} />}
                </div>

                {lastAddedIds.length > 0 && (
                    <footer role="status" className="flex flex-wrap items-center justify-between gap-4 border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 lg:px-6">
                        <span>Đã nhập {lastAddedIds.length} câu vào đề.</span>
                        <button type="button" aria-label="Hoàn tác nhập câu hỏi" onClick={undoImport} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold"><RotateCcw className="h-4 w-4" /> Hoàn tác</button>
                    </footer>
                )}
            </section>
        </div>
    );
};

export default QuestionImportDrawer;
