import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { ModuleIcon } from '../../../components/common';
import {
    QuestionBankApiError,
    testBankService,
    type TestBankItem,
} from '../../../services/testBankService';
import { resolveRuntimeFeatureFlag } from '../../../services/featureRolloutService';
import type { Question } from '../../../types';
import { QuestionBankFilters } from '../../question-bank/components/QuestionBankFilters';
import { QuestionBankPagination } from '../../question-bank/components/QuestionBankPagination';
import type {
    QuestionBankFilters as Filters,
    QuestionBankItem,
    QuestionBankScope,
} from '../../question-bank/questionBank.types';
import { useQuestionBank } from '../../question-bank/useQuestionBank';
import LegacyTestBankBrowser, {
    cloneQuestionFromBank,
    QuestionBankBrowser,
} from './TestBankBrowser';

interface TestBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddQuestion: (question: Question) => void;
    teacherId: string;
}

const LegacyTestBankModal: React.FC<TestBankModalProps> = ({ isOpen, onClose, onAddQuestion, teacherId }) => {
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
                        <ModuleIcon name="question-bank" size="md" priority />
                        <div><h2 className="text-xl font-semibold text-slate-900">Ngân hàng câu hỏi cá nhân</h2><p className="mt-1 text-sm text-slate-600">Tìm, lọc và chọn nhiều câu hỏi đã lưu.</p></div>
                    </div>
                    <button type="button" aria-label="Đóng ngân hàng câu hỏi" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>
                <LegacyTestBankBrowser items={items} loading={loading} selectedIds={selectedIds} onToggle={toggle} onDelete={(item) => void remove(item)} />
                <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 lg:px-6">
                    <p className="text-sm text-slate-600">Đã chọn <strong>{selectedItems.length}</strong> câu</p>
                    <button type="button" disabled={selectedItems.length === 0} onClick={addSelected} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Thêm {selectedItems.length} câu vào đề</button>
                </footer>
            </section>
        </div>
    );
};

const initialFilters = (scope: QuestionBankScope): Filters => ({
    scope,
    search: '',
    page: 1,
    pageSize: 30,
});

const SystemQuestionBankModal: React.FC<TestBankModalProps> = ({ isOpen, onClose, onAddQuestion }) => {
    const [activeScope, setActiveScope] = useState<QuestionBankScope>('SYSTEM');
    const [filters, setFilters] = useState<Filters>(() => initialFilters('SYSTEM'));
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const checkedSystemEmpty = useRef(false);
    const bank = useQuestionBank(filters, isOpen);
    const selectedItems = useMemo(
        () => bank.items.filter((item) => selectedIds.has(item.id)),
        [bank.items, selectedIds],
    );

    useEffect(() => {
        if (!isOpen) {
            checkedSystemEmpty.current = false;
            setActiveScope('SYSTEM');
            setFilters(initialFilters('SYSTEM'));
            setSelectedIds(new Set());
        }
    }, [isOpen]);

    useEffect(() => {
        if (
            isOpen
            && activeScope === 'SYSTEM'
            && bank.loaded
            && !bank.loading
            && !bank.error
            && !checkedSystemEmpty.current
        ) {
            checkedSystemEmpty.current = true;
            if (bank.pagination.totalItems === 0) {
                setActiveScope('PERSONAL');
                setFilters(initialFilters('PERSONAL'));
            }
        }
    }, [activeScope, bank.error, bank.loaded, bank.loading, bank.pagination.totalItems, isOpen]);

    if (!isOpen) return null;

    const selectScope = (scope: QuestionBankScope) => {
        setActiveScope(scope);
        setFilters(initialFilters(scope));
        setSelectedIds(new Set());
    };

    const toggle = (id: string) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const copyToPersonal = async (item: QuestionBankItem) => {
        try {
            await testBankService.copyQuestionToPersonal(item.id);
            toast.success('Đã sao chép câu hỏi về kho của tôi.');
        } catch (error) {
            if (error instanceof QuestionBankApiError && error.code === 'DUPLICATE_QUESTION') {
                toast('Câu hỏi này đã có trong kho của tôi.');
                return;
            }
            toast.error('Không thể sao chép câu hỏi.');
        }
    };

    const removePersonal = async (item: QuestionBankItem) => {
        if (!globalThis.confirm('Bạn có chắc muốn xóa câu hỏi này khỏi kho của tôi?')) return;
        try {
            await testBankService.archiveQuestionBankItem(item.id);
            setSelectedIds((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
            bank.reload();
            toast.success('Đã xóa câu hỏi khỏi kho của tôi.');
        } catch {
            toast.error('Không thể xóa câu hỏi.');
        }
    };

    const addSelected = () => {
        selectedItems.forEach((item) => onAddQuestion(cloneQuestionFromBank(item.questionData)));
        setSelectedIds(new Set());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:p-4">
            <section role="dialog" aria-modal="true" aria-label="Ngân hàng câu hỏi" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <ModuleIcon name="question-bank" size="md" priority />
                        <div><h2 className="text-xl font-semibold text-slate-900">Ngân hàng câu hỏi</h2><p className="mt-1 text-sm text-slate-600">Chọn câu hỏi hệ thống hoặc quản lý kho cá nhân.</p></div>
                    </div>
                    <button type="button" aria-label="Đóng ngân hàng câu hỏi" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </header>

                <div role="tablist" aria-label="Phạm vi ngân hàng câu hỏi" className="flex gap-1 border-b border-slate-200 bg-white px-4 pt-3 sm:px-6">
                    {(['SYSTEM', 'PERSONAL'] as const).map((scope) => (
                        <button
                            key={scope}
                            type="button"
                            role="tab"
                            aria-selected={activeScope === scope}
                            onClick={() => selectScope(scope)}
                            className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${activeScope === scope ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            {scope === 'SYSTEM' ? 'Kho hệ thống' : 'Kho của tôi'}
                        </button>
                    ))}
                </div>

                <QuestionBankFilters value={filters} onChange={(next) => {
                    setFilters({ ...next, scope: activeScope });
                    setSelectedIds(new Set());
                }} />

                {bank.error ? (
                    <div role="alert" className="m-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800">
                        <p>{bank.error}</p>
                        <button type="button" onClick={bank.reload} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 font-semibold">Thử lại</button>
                    </div>
                ) : (
                    <QuestionBankBrowser
                        items={bank.items}
                        scope={activeScope}
                        loading={bank.loading}
                        selectedIds={selectedIds}
                        onToggle={toggle}
                        onCopyToPersonal={activeScope === 'SYSTEM' ? (item) => void copyToPersonal(item) : undefined}
                        onDelete={activeScope === 'PERSONAL' ? (item) => void removePersonal(item) : undefined}
                    />
                )}

                <QuestionBankPagination
                    value={bank.pagination}
                    onPageChange={(page) => {
                        setFilters((current) => ({ ...current, page }));
                        setSelectedIds(new Set());
                    }}
                    onPageSizeChange={(pageSize) => {
                        setFilters((current) => ({ ...current, page: 1, pageSize }));
                        setSelectedIds(new Set());
                    }}
                />

                <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-sm text-slate-600">Đã chọn <strong>{selectedItems.length}</strong> câu</p>
                    <button type="button" disabled={selectedItems.length === 0} onClick={addSelected} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Thêm {selectedItems.length} câu vào đề</button>
                </footer>
            </section>
        </div>
    );
};

export const TestBankModal: React.FC<TestBankModalProps> = (props) => {
    const [flag, setFlag] = useState({ ready: false, enabled: false });

    useEffect(() => {
        if (!props.isOpen) {
            setFlag({ ready: false, enabled: false });
            return;
        }
        let active = true;
        const resolveFlag = () => {
            setFlag((current) => ({ ...current, ready: false }));
            resolveRuntimeFeatureFlag('system_question_bank_v1')
                .then((result) => {
                    if (active) setFlag({ ready: true, enabled: result.enabled });
                })
                .catch(() => {
                    if (active) setFlag({ ready: true, enabled: false });
                });
        };
        const onFlagUpdate = (event: Event) => {
            const key = (event as CustomEvent<{ key?: string }>).detail?.key;
            if (!key || key === 'system_question_bank_v1') resolveFlag();
        };
        resolveFlag();
        window.addEventListener('tohieuquiz:feature-flags-updated', onFlagUpdate);
        return () => {
            active = false;
            window.removeEventListener('tohieuquiz:feature-flags-updated', onFlagUpdate);
        };
    }, [props.isOpen]);

    if (!props.isOpen) return null;
    if (!flag.ready) {
        return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
                <div role="status" className="rounded-xl bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-xl">Đang tải cấu hình ngân hàng câu hỏi…</div>
            </div>
        );
    }
    return flag.enabled ? <SystemQuestionBankModal {...props} /> : <LegacyTestBankModal {...props} />;
};
