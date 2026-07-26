import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Library, Plus, X } from 'lucide-react';
import TestBankBrowser, { cloneQuestionFromBank } from '../../quiz-editor/components/TestBankBrowser';
import { testBankService, type TestBankItem } from '../../../services/testBankService';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

interface QuestionBankDrawerProps {
    open: boolean;
    teacherId: string;
    onClose: () => void;
}

const QuestionBankDrawer: React.FC<QuestionBankDrawerProps> = ({ open, teacherId, onClose }) => {
    const [items, setItems] = useState<TestBankItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const addQuestions = useManualQuizWorkspaceStore((state) => state.addQuestions);
    const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);

    useEffect(() => {
        if (!open || !teacherId) return;
        let active = true;
        setLoading(true);
        setError(null);
        testBankService.getTestBank(teacherId)
            .then((data) => {
                if (active) setItems(data);
            })
            .catch((loadError) => {
                if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải kho câu hỏi.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [open, teacherId]);

    useDialogFocusTrap({
        open,
        containerRef: drawerRef,
        initialFocusRef: closeButtonRef,
        onEscape: onClose,
    });

    if (!open) return null;

    const toggle = (id: string) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const addSelected = () => {
        if (selectedItems.length === 0) return;
        addQuestions(selectedItems.map((item) => cloneQuestionFromBank(item.question_data) as ManualQuizQuestion));
        setSelectedIds(new Set());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={onClose}>
            <section ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Kho câu hỏi" onMouseDown={(event) => event.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Library className="h-5 w-5" /></span>
                        <div><h2 className="text-xl font-semibold text-slate-900">Kho câu hỏi</h2><p className="mt-1 text-sm text-slate-600">Chọn nhiều câu rồi thêm một lần vào đề đang soạn.</p></div>
                    </div>
                    <button ref={closeButtonRef} type="button" aria-label="Đóng kho câu hỏi" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>
                {error ? <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : (
                    <TestBankBrowser items={items} loading={loading} selectedIds={selectedIds} onToggle={toggle} />
                )}
                <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-4 lg:px-6">
                    <p className="text-sm text-slate-600">Đã chọn <strong>{selectedItems.length}</strong> câu</p>
                    <button type="button" disabled={selectedItems.length === 0} onClick={addSelected} aria-label={`Thêm ${selectedItems.length} câu vào đề`} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Thêm {selectedItems.length} câu vào đề</button>
                </footer>
            </section>
        </div>
    );
};

export default QuestionBankDrawer;
