import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { CheckCheck, ChevronLeft, FileUp, Library, ListChecks, Plus, RotateCcw, Search, X } from 'lucide-react';
import { QuestionType } from '../../../types';
import {
    createManualQuestionDraft,
    QUICK_ADD_TYPES,
} from '../../../components/TeacherDashboard/quiz-preview/questionTypes';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import QuestionNavigatorItem, { getQuestionNavigatorLabel } from './QuestionNavigatorItem';
import { useQuestionUndo } from '../hooks/useQuestionUndo';
import QuestionTypePicker from './QuestionTypePicker';
import BulkQuestionActions from './BulkQuestionActions';
import { useBulkQuestionSelection } from '../hooks/useBulkQuestionSelection';
import { getQuestionOverviewRows, type QuestionOverviewStatus } from '../overview/questionOverviewModel';

export const handleQuestionDragEnd = (
    event: Pick<DragEndEvent, 'active' | 'over'>,
    reorderQuestion: (activeId: string, overId: string) => void,
): void => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    reorderQuestion(activeId, overId);
};

interface QuestionNavigatorProps {
    onOpenQuestionBank?: () => void;
    onOpenImport?: () => void;
    onBeforeAction?: () => boolean;
    onEditQuestion?: (questionId: string) => void;
    onQuestionAdded?: (questionId: string) => void;
    issues?: import('../validation/validationActions').ManualQuizIssue[];
    readOnly?: boolean;
    teacherId?: string;
    variant?: 'compact' | 'overview';
}

const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
    onOpenQuestionBank,
    onOpenImport,
    onBeforeAction,
    onEditQuestion,
    onQuestionAdded,
    issues = [],
    readOnly = false,
    teacherId = '',
    variant = 'compact',
}) => {
    const [query, setQuery] = useState('');
    const [isTypePickerOpen, setTypePickerOpen] = useState(false);
    const [overviewStatusFilter, setOverviewStatusFilter] = useState<'all' | QuestionOverviewStatus>('all');
    const [overviewTypeFilter, setOverviewTypeFilter] = useState('all');
    const [newQuestionIds, setNewQuestionIds] = useState<Set<string>>(() => new Set());
    const questionIdsBeforeExternalAddRef = useRef<Set<string> | null>(null);
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const selectQuestion = useManualQuizWorkspaceStore((state) => state.selectQuestion);
    const addQuestion = useManualQuizWorkspaceStore((state) => state.addQuestion);
    const duplicateQuestion = useManualQuizWorkspaceStore((state) => state.duplicateQuestion);
    const moveQuestion = useManualQuizWorkspaceStore((state) => state.moveQuestion);
    const reorderQuestion = useManualQuizWorkspaceStore((state) => state.reorderQuestion);
    const setNavigatorCollapsed = useManualQuizWorkspaceStore((state) => state.setNavigatorCollapsed);
    const undo = useQuestionUndo();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor),
    );
    const questions = envelope?.quiz.questions ?? [];
    const bulkSelection = useBulkQuestionSelection(questions.map((question) => question.id));
    const isOverview = variant === 'overview';
    const overviewRows = useMemo(() => getQuestionOverviewRows(questions, issues), [issues, questions]);
    const overviewTypes = useMemo(() => Array.from(new Set(overviewRows.map((row) => row.type))), [overviewRows]);
    useEffect(() => {
        const previousIds = questionIdsBeforeExternalAddRef.current;
        if (!previousIds) return;
        const addedIds = questions
            .map((question) => question.id)
            .filter((questionId) => !previousIds.has(questionId));
        if (addedIds.length > 0) {
            setNewQuestionIds((current) => {
                const next = new Set(current);
                addedIds.forEach((questionId) => next.add(questionId));
                return next.size === current.size ? current : next;
            });
            questionIdsBeforeExternalAddRef.current = null;
            return;
        }
        questionIdsBeforeExternalAddRef.current = new Set(questions.map((question) => question.id));
    }, [questions]);
    const filteredQuestions = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return questions;
        return questions.filter((question, index) =>
            getQuestionNavigatorLabel(question).toLowerCase().includes(normalized)
            || String(index + 1).includes(normalized),
        );
    }, [query, questions]);

    const filteredOverviewRows = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return overviewRows.filter((row) => {
            const matchesQuery = !normalized
                || row.label.toLowerCase().includes(normalized)
                || String(row.number).includes(normalized);
            const matchesStatus = overviewStatusFilter === 'all' || row.status === overviewStatusFilter;
            const matchesType = overviewTypeFilter === 'all' || row.type === overviewTypeFilter;
            return matchesQuery && matchesStatus && matchesType;
        });
    }, [overviewRows, overviewStatusFilter, overviewTypeFilter, query]);

    const createQuestion = (type: QuestionType) => {
        if (onBeforeAction && !onBeforeAction()) return;
        questionIdsBeforeExternalAddRef.current = null;
        const draft = createManualQuestionDraft(type) as ManualQuizQuestion;
        addQuestion(draft);
        onQuestionAdded?.(draft.id);
        setTypePickerOpen(false);
    };

    const runAction = (action: () => void) => {
        if (onBeforeAction && !onBeforeAction()) return;
        action();
    };

    const duplicateQuestionSafely = (questionId: string) => runAction(() => {
        questionIdsBeforeExternalAddRef.current = null;
        duplicateQuestion(questionId);
    });

    const undoDeletionSafely = () => runAction(() => {
        questionIdsBeforeExternalAddRef.current = null;
        undo.undoDeletion();
    });

    const handleQuestionSelect = (questionId: string) => {
        runAction(() => {
            if (isOverview && onEditQuestion) {
                onEditQuestion(questionId);
                return;
            }
            selectQuestion(questionId);
        });
    };

    const totalPoints = overviewRows.reduce((total, row) => total + row.points, 0);
    const needsFixCount = overviewRows.filter((row) => row.status === 'needs-fix').length;

    if (isOverview) {
        return (
            <main
                aria-label="Tổng quan câu hỏi"
                data-pane-width="full"
                data-question-navigator-variant="overview"
                className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#FFFDF7]"
            >
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold text-[#172033]">Tổng quan câu hỏi</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {questions.length} câu <span aria-hidden="true">•</span> {totalPoints} điểm <span aria-hidden="true">•</span> {needsFixCount} câu cần sửa
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {!readOnly && questions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => bulkSelection.setSelectionMode(!bulkSelection.selectionMode)}
                                    aria-label={bulkSelection.selectionMode ? 'Thoát chọn nhiều câu hỏi' : 'Chọn nhiều câu hỏi'}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    {bulkSelection.selectionMode ? <X className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                                    {bulkSelection.selectionMode ? 'Thoát chọn' : 'Chọn nhiều'}
                                </button>
                            )}
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => setTypePickerOpen(true)}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                                >
                                    <Plus className="h-4 w-4" /> Thêm câu
                                </button>
                            )}
                        </div>
                    </div>
                    {bulkSelection.selectionMode && (
                        <button
                            type="button"
                            onClick={bulkSelection.selectedIds.size === questions.length ? bulkSelection.clear : bulkSelection.selectAll}
                            aria-label={bulkSelection.selectedIds.size === questions.length ? 'Bỏ chọn tất cả câu hỏi' : 'Chọn tất cả câu hỏi'}
                            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800"
                        >
                            <CheckCheck className="h-4 w-4" />
                            {bulkSelection.selectedIds.size === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                    )}
                    <div className="mt-4 flex flex-col gap-2 lg:flex-row">
                        <label className="relative block min-w-0 flex-1">
                            <span className="sr-only">Tìm câu hỏi</span>
                            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Tìm theo số câu hoặc nội dung…"
                                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'needs-fix'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    aria-pressed={overviewStatusFilter === filter}
                                    onClick={() => setOverviewStatusFilter(filter)}
                                    className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${overviewStatusFilter === filter ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {filter === 'all' ? 'Tất cả' : 'Cần sửa'}
                                </button>
                            ))}
                            <label className="sr-only" htmlFor="question-overview-type-filter">Lọc theo dạng câu</label>
                            <select
                                id="question-overview-type-filter"
                                aria-label="Lọc theo dạng câu"
                                value={overviewTypeFilter}
                                onChange={(event) => setOverviewTypeFilter(event.target.value)}
                                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                            >
                                <option value="all">Tất cả dạng câu</option>
                                {overviewTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {filteredOverviewRows.length === 0 && (
                        <div className="m-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                            {questions.length === 0 ? 'Chưa có câu hỏi nào.' : 'Không tìm thấy câu hỏi phù hợp.'}
                        </div>
                    )}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                            if (onBeforeAction && !onBeforeAction()) return;
                            handleQuestionDragEnd(event, reorderQuestion);
                        }}
                    >
                        <div className="divide-y divide-slate-200 border-b border-slate-200 bg-white">
                            {filteredOverviewRows.map((overviewRow) => {
                                const question = questions.find((item) => item.id === overviewRow.id);
                                if (!question) return null;
                                const index = questions.findIndex((item) => item.id === question.id);
                                return (
                                    <QuestionNavigatorItem
                                        key={question.id}
                                        question={question}
                                        index={index}
                                        total={questions.length}
                                        selected={envelope?.selectedQuestionId === question.id}
                                        readOnly={readOnly}
                                        variant="overview"
                                        overviewRow={overviewRow}
                                        isNew={newQuestionIds.has(question.id)}
                                        selectionMode={bulkSelection.selectionMode}
                                        bulkSelected={bulkSelection.selectedIds.has(question.id)}
                                        onToggleBulk={() => bulkSelection.toggle(question.id)}
                                        onSelect={() => handleQuestionSelect(question.id)}
                                        onMove={(offset) => runAction(() => moveQuestion(question.id, offset))}
                                        onDuplicate={() => duplicateQuestionSafely(question.id)}
                                        onDelete={() => runAction(() => undo.deleteWithUndo(question.id))}
                                    />
                                );
                            })}
                        </div>
                    </DndContext>
                </div>

                {bulkSelection.selectedIds.size > 0 && (
                    <BulkQuestionActions
                        selectedIds={bulkSelection.selectedIds}
                        teacherId={teacherId}
                        onClear={bulkSelection.clear}
                        onBeforeAction={onBeforeAction}
                    />
                )}
                {undo.pendingDeletion && (
                    <div role="status" aria-label="Hoàn tác xóa câu hỏi" className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p>Đã xóa câu {undo.pendingDeletion.displayNumber}.</p>
                        <button type="button" onClick={undoDeletionSafely} aria-label="Hoàn tác xóa câu hỏi" className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold text-amber-800">
                            <RotateCcw className="h-4 w-4" /> Hoàn tác
                        </button>
                    </div>
                )}

                {!readOnly && (
                    <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thêm nhanh</span>
                            {QUICK_ADD_TYPES.map((item) => (
                                <button key={item.type} type="button" onClick={() => createQuestion(item.type)} aria-label={`Thêm nhanh ${item.label}`} title={item.description} className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${item.color}`}>
                                    {item.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => runAction(() => {
                                questionIdsBeforeExternalAddRef.current = new Set(questions.map((question) => question.id));
                                onOpenQuestionBank?.();
                            })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium">
                                <Library className="h-4 w-4" /> Kho câu hỏi
                            </button>
                            <button type="button" onClick={() => runAction(() => {
                                questionIdsBeforeExternalAddRef.current = new Set(questions.map((question) => question.id));
                                onOpenImport?.();
                            })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium">
                                <FileUp className="h-4 w-4" /> Nhập từ tệp
                            </button>
                        </div>
                    </div>
                )}

                <QuestionTypePicker open={isTypePickerOpen} onClose={() => setTypePickerOpen(false)} onSelect={createQuestion} />
            </main>
        );
    }

    return (
        <nav
            aria-label="Danh sách câu hỏi"
            data-pane-width="280"
            className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50 md:w-[280px]"
        >
            <div className="shrink-0 border-b border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-[#172033]">Câu hỏi ({questions.length})</h2>
                    <div className="flex items-center gap-1">
                        {questions.length > 0 && !readOnly && (
                            <button
                                type="button"
                                onClick={() => bulkSelection.setSelectionMode(!bulkSelection.selectionMode)}
                                aria-label={bulkSelection.selectionMode ? 'Thoát chọn nhiều câu hỏi' : 'Chọn nhiều câu hỏi'}
                                className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-white"
                            >
                                {bulkSelection.selectionMode ? <X className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                            </button>
                        )}
                    <button
                        type="button"
                        onClick={() => setNavigatorCollapsed(true)}
                        aria-label="Thu gọn danh sách câu hỏi"
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-white"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    </div>
                </div>
                {bulkSelection.selectionMode && (
                    <button
                        type="button"
                        onClick={bulkSelection.selectedIds.size === questions.length ? bulkSelection.clear : bulkSelection.selectAll}
                        aria-label={bulkSelection.selectedIds.size === questions.length ? 'Bỏ chọn tất cả câu hỏi' : 'Chọn tất cả câu hỏi'}
                        className="mb-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800"
                    >
                        <CheckCheck className="h-4 w-4" />
                        {bulkSelection.selectedIds.size === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                )}
                <label className="relative block">
                    <span className="sr-only">Tìm câu hỏi</span>
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Tìm câu hỏi…"
                        className="h-10 w-full rounded-[10px] border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500"
                    />
                </label>
            </div>

            <div
                data-testid="question-navigator-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            >
                {filteredQuestions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        {questions.length === 0 ? 'Chưa có câu hỏi nào.' : 'Không tìm thấy câu hỏi.'}
                    </div>
                )}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => {
                        if (onBeforeAction && !onBeforeAction()) return;
                        handleQuestionDragEnd(event, reorderQuestion);
                    }}
                >
                    <div className="space-y-2">
                        {filteredQuestions.map((question) => {
                            const index = questions.findIndex((item) => item.id === question.id);
                            return (
                                <QuestionNavigatorItem
                                    key={question.id}
                                    question={question}
                                    index={index}
                                    total={questions.length}
                                    selected={envelope?.selectedQuestionId === question.id}
                                    readOnly={readOnly}
                                    selectionMode={bulkSelection.selectionMode}
                                    bulkSelected={bulkSelection.selectedIds.has(question.id)}
                                    onToggleBulk={() => bulkSelection.toggle(question.id)}
                                    onSelect={() => runAction(() => selectQuestion(question.id))}
                                    onMove={(offset) => runAction(() => moveQuestion(question.id, offset))}
                                    onDuplicate={() => duplicateQuestionSafely(question.id)}
                                    onDelete={() => runAction(() => undo.deleteWithUndo(question.id))}
                                />
                            );
                        })}
                    </div>
                </DndContext>
            </div>

            {bulkSelection.selectedIds.size > 0 && (
                <BulkQuestionActions
                    selectedIds={bulkSelection.selectedIds}
                    teacherId={teacherId}
                    onClear={bulkSelection.clear}
                    onBeforeAction={onBeforeAction}
                />
            )}

            {undo.pendingDeletion && (
                <div
                    role="status"
                    aria-label="Hoàn tác xóa câu hỏi"
                    className="mx-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                    <p>Đã xóa câu {undo.pendingDeletion.displayNumber}.</p>
                    <button
                        type="button"
                        onClick={undoDeletionSafely}
                        aria-label="Hoàn tác xóa câu hỏi"
                        className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold text-amber-800"
                    >
                        <RotateCcw className="h-4 w-4" /> Hoàn tác
                    </button>
                </div>
            )}

            <div className="shrink-0 space-y-3 border-t border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thêm nhanh</p>
                {!readOnly && <div className="grid grid-cols-2 gap-2">
                    {QUICK_ADD_TYPES.map((item) => (
                        <button
                            key={item.type}
                            type="button"
                            onClick={() => createQuestion(item.type)}
                            aria-label={`Thêm nhanh ${item.label}`}
                            title={item.description}
                            className={`min-h-11 rounded-[10px] px-2 text-xs font-semibold transition ${item.color}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>}
                {!readOnly && <button
                    type="button"
                    onClick={() => setTypePickerOpen(true)}
                    aria-label="Thêm dạng khác"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-sky-500 px-3 text-sm font-semibold text-white hover:bg-sky-600"
                >
                    <Plus className="h-4 w-4" /> Thêm dạng khác
                </button>}
                {!readOnly && <button
                    type="button"
                    onClick={() => runAction(() => {
                        questionIdsBeforeExternalAddRef.current = new Set(questions.map((question) => question.id));
                        onOpenQuestionBank?.();
                    })}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-medium"
                >
                    <Library className="h-4 w-4" /> Mở kho câu hỏi
                </button>}
                {!readOnly && <button
                    type="button"
                    onClick={() => runAction(() => {
                        questionIdsBeforeExternalAddRef.current = new Set(questions.map((question) => question.id));
                        onOpenImport?.();
                    })}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-medium"
                >
                    <FileUp className="h-4 w-4" /> Nhập từ tệp
                </button>}
            </div>

            <QuestionTypePicker
                open={isTypePickerOpen}
                onClose={() => setTypePickerOpen(false)}
                onSelect={createQuestion}
            />
        </nav>
    );
};

export default QuestionNavigator;
