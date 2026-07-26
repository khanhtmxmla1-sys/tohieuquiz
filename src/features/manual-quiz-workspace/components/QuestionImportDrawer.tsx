import React, { useRef, useState } from 'react';
import { FileSpreadsheet, RotateCcw, X } from 'lucide-react';
import QuestionImportReview from '../import/QuestionImportReview';
import type { QuestionImportResult } from '../import/questionImport.types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

interface QuestionImportDrawerProps {
    open: boolean;
    onClose: () => void;
}

const QuestionImportDrawer: React.FC<QuestionImportDrawerProps> = ({ open, onClose }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [result, setResult] = useState<QuestionImportResult | null>(null);
    const [fileName, setFileName] = useState('');
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
                ? await import('../import/docxQuestionImporter').then((module) => module.importQuestionDocx(file))
                : await import('../import/spreadsheetQuestionImporter').then((module) => module.importQuestionSpreadsheet(file));
            setResult(imported);
        } catch (importError) {
            setError(importError instanceof Error ? importError.message : 'Không thể đọc tệp câu hỏi.');
            setResult(null);
        } finally {
            setLoading(false);
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

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={onClose}>
            <section ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Nhập câu hỏi từ tệp" onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>
                        <div><h2 className="text-xl font-semibold text-slate-900">Nhập câu hỏi từ tệp</h2><p className="mt-1 text-sm text-slate-600">CSV/XLSX theo mẫu hoặc DOCX có cấu trúc Câu – phương án – đáp án.</p></div>
                    </div>
                    <button ref={closeButtonRef} type="button" aria-label="Đóng nhập câu hỏi" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>

                <div className="border-b border-slate-200 bg-slate-50 p-4">
                    <input ref={inputRef} type="file" accept=".csv,.xlsx,.docx" aria-label="Chọn tệp câu hỏi" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
                    <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-emerald-600 px-5 text-sm font-semibold text-white"><FileSpreadsheet className="h-4 w-4" /> Chọn tệp CSV, XLSX hoặc DOCX</button>
                    {fileName && <span className="ml-3 text-sm text-slate-600">{fileName}</span>}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-6">
                    {loading && <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Đang phân tích tệp…</div>}
                    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
                    {!loading && !error && !result && <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">Chọn một tệp để xem trước các câu hỏi trước khi nhập.</div>}
                    {!loading && result && <QuestionImportReview result={result} onImport={importQuestions} />}
                </div>

                {lastAddedIds.length > 0 && (
                    <footer role="status" className="flex items-center justify-between gap-4 border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 lg:px-6">
                        <span>Đã nhập {lastAddedIds.length} câu vào đề.</span>
                        <button type="button" aria-label="Hoàn tác nhập câu hỏi" onClick={undoImport} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold"><RotateCcw className="h-4 w-4" /> Hoàn tác</button>
                    </footer>
                )}
            </section>
        </div>
    );
};

export default QuestionImportDrawer;
