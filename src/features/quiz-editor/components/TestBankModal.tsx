import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Library, Plus, X } from 'lucide-react';
import { testBankService, type TestBankItem } from '../../../services/testBankService';
import type { Question } from '../../../types';
import TestBankBrowser, { cloneQuestionFromBank } from './TestBankBrowser';

interface TestBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddQuestion: (question: Question) => void;
    teacherId: string;
}

export const TestBankModal: React.FC<TestBankModalProps> = ({ isOpen, onClose, onAddQuestion, teacherId }) => {
    const [items, setItems] = useState<TestBankItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);

    useEffect(() => {
        if (!isOpen || !teacherId) return;
        let active = true;
        setLoading(true);
        testBankService.getTestBank(teacherId)
            .then((data) => { if (active) setItems(data); })
            .catch(() => toast.error('Không thể tải ngân hàng câu hỏi'))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [isOpen, teacherId]);

    if (!isOpen) return null;

    const toggle = (id: string) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const remove = async (item: TestBankItem) => {
        if (!globalThis.confirm('Bạn có chắc muốn xóa câu hỏi này khỏi ngân hàng?')) return;
        try {
            await testBankService.deleteQuestion(item.id);
            setItems((current) => current.filter((entry) => entry.id !== item.id));
            setSelectedIds((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
        } catch {
            toast.error('Không thể xóa câu hỏi');
        }
    };

    const addSelected = () => {
        selectedItems.forEach((item) => onAddQuestion(cloneQuestionFromBank(item.question_data)));
        setSelectedIds(new Set());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <section role="dialog" aria-modal="true" aria-label="Ngân hàng câu hỏi cá nhân" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Library className="h-5 w-5" /></span>
                        <div><h2 className="text-xl font-semibold text-slate-900">Ngân hàng câu hỏi cá nhân</h2><p className="mt-1 text-sm text-slate-600">Tìm, lọc và chọn nhiều câu hỏi đã lưu.</p></div>
                    </div>
                    <button type="button" aria-label="Đóng ngân hàng câu hỏi" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>
                <TestBankBrowser items={items} loading={loading} selectedIds={selectedIds} onToggle={toggle} onDelete={(item) => void remove(item)} />
                <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 lg:px-6">
                    <p className="text-sm text-slate-600">Đã chọn <strong>{selectedItems.length}</strong> câu</p>
                    <button type="button" disabled={selectedItems.length === 0} onClick={addSelected} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Bốc {selectedItems.length} câu vào đề</button>
                </footer>
            </section>
        </div>
    );
};
