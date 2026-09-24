import React, { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowDown,
    ArrowUp,
    Copy,
    GripVertical,
    MoreHorizontal,
    Trash2,
} from 'lucide-react';
import MathSpan from '../../../components/common/MathSpan';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { getQuestionOverviewLabel, type QuestionOverviewRow } from '../overview/questionOverviewModel';

export const getQuestionNavigatorLabel = getQuestionOverviewLabel;

interface QuestionNavigatorItemProps {
    question: ManualQuizQuestion;
    index: number;
    total: number;
    selected: boolean;
    selectionMode?: boolean;
    bulkSelected?: boolean;
    readOnly?: boolean;
    variant?: 'compact' | 'overview';
    overviewRow?: QuestionOverviewRow;
    isNew?: boolean;
    onToggleBulk?(): void;
    onSelect(): void;
    onMove(offset: -1 | 1): void;
    onDuplicate(): void;
    onDelete(): void;
}

const QuestionNavigatorItem: React.FC<QuestionNavigatorItemProps> = ({
    question,
    index,
    total,
    selected,
    selectionMode = false,
    bulkSelected = false,
    readOnly = false,
    variant = 'compact',
    overviewRow,
    isNew = false,
    onToggleBulk,
    onSelect,
    onMove,
    onDuplicate,
    onDelete,
}) => {
    const draggable = useDraggable({ id: question.id, disabled: selectionMode });
    const droppable = useDroppable({ id: question.id });
    const setNodeRef = useCallback((node: HTMLElement | null) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
    }, [draggable.setNodeRef, droppable.setNodeRef]);
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(draggable.transform),
        opacity: draggable.isDragging ? 0.55 : 1,
    };

    if (variant === 'overview' && overviewRow) {
        const statusCopy = {
            ready: 'Sẵn sàng',
            warning: 'Cảnh báo',
            'needs-fix': 'Cần sửa',
        } as const;
        return (
            <article
                ref={setNodeRef}
                style={style}
                data-question-id={question.id}
                data-new-question={isNew ? 'true' : undefined}
                className={`grid min-w-0 gap-3 border-b border-slate-200 bg-white px-4 py-3 transition lg:grid-cols-[auto_minmax(0,1fr)_180px_120px_auto] lg:items-center ${
                    isNew
                        ? 'bg-sky-50 ring-1 ring-inset ring-sky-200'
                        : bulkSelected
                            ? 'bg-violet-50 ring-2 ring-inset ring-violet-200'
                            : selected ? 'bg-sky-50' : 'hover:bg-slate-50'
                } ${droppable.isOver && !draggable.isDragging && !selectionMode ? 'ring-2 ring-inset ring-sky-300' : ''}`}
            >
                <div className="flex items-center gap-2">
                    {selectionMode && (
                        <label className="grid h-11 w-8 shrink-0 place-items-center">
                            <span className="sr-only">Chọn hàng loạt câu {index + 1}</span>
                            <input
                                type="checkbox"
                                aria-label={`Chọn hàng loạt câu ${index + 1}`}
                                checked={bulkSelected}
                                onChange={onToggleBulk}
                                className="h-5 w-5 rounded border-slate-300 accent-violet-600"
                            />
                        </label>
                    )}
                    {!selectionMode && !readOnly && (
                        <button
                            ref={draggable.setActivatorNodeRef}
                            type="button"
                            aria-label={`Kéo câu ${index + 1}`}
                            title={`Kéo câu ${index + 1}`}
                            className="grid h-11 w-8 shrink-0 cursor-grab place-items-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
                            {...draggable.listeners}
                            {...draggable.attributes}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    )}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-sm font-semibold tabular-nums text-slate-700">
                        {overviewRow.number}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={selectionMode ? onToggleBulk : onSelect}
                    aria-label={`Chọn câu ${overviewRow.number}: ${overviewRow.label}`}
                    className="min-w-0 rounded-lg p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                    {isNew && <span className="mb-1 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sm font-semibold text-sky-700">Mới thêm</span>}
                    <span className="line-clamp-2 block text-[15px] font-medium leading-6 text-[#172033]">
                        <MathSpan content={overviewRow.label} />
                    </span>
                    {overviewRow.firstIssue && (
                        <span className="mt-1 block truncate text-xs text-slate-500">{overviewRow.firstIssue.message}</span>
                    )}
                </button>

                <span className="min-w-0 text-sm text-slate-600">
                    {overviewRow.type} <span aria-hidden="true">•</span> {overviewRow.points} điểm
                </span>

                <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    overviewRow.status === 'needs-fix'
                        ? 'bg-rose-50 text-rose-700'
                        : overviewRow.status === 'warning'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                }`}>
                    {statusCopy[overviewRow.status]}
                </span>

                <div className="flex items-center justify-end gap-2">
                    {!selectionMode && (
                        <button
                            type="button"
                            onClick={onSelect}
                            aria-label={`${readOnly ? 'Xem' : 'Sửa'} câu ${overviewRow.number}`}
                            className="min-h-11 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                        >
                            {readOnly ? 'Xem' : 'Sửa'}
                        </button>
                    )}
                    {!readOnly && !selectionMode && (
                        <details className="group">
                            <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500" aria-label={`Thao tác khác cho câu ${overviewRow.number}`}>
                                <MoreHorizontal className="h-4 w-4" />
                            </summary>
                            <div className="mt-1 grid min-w-36 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                                <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-40">Di chuyển lên</button>
                                <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-40">Di chuyển xuống</button>
                                <button type="button" onClick={onDuplicate} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">Nhân bản</button>
                                <button type="button" onClick={onDelete} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">Xóa</button>
                            </div>
                        </details>
                    )}
                </div>
            </article>
        );
    }

    return (
        <article
            ref={setNodeRef}
            style={style}
            data-question-id={question.id}
            className={`rounded-xl border bg-white p-2 transition ${
                bulkSelected
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                    : selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'
            } ${droppable.isOver && !draggable.isDragging && !selectionMode ? 'ring-2 ring-sky-300' : ''}`}
        >
            <div className="flex items-start gap-1.5">
                {selectionMode && (
                    <label className="grid h-11 w-8 shrink-0 place-items-center">
                        <span className="sr-only">Chọn hàng loạt câu {index + 1}</span>
                        <input
                            type="checkbox"
                            aria-label={`Chọn hàng loạt câu ${index + 1}`}
                            checked={bulkSelected}
                            onChange={onToggleBulk}
                            className="h-5 w-5 rounded border-slate-300 accent-violet-600"
                        />
                    </label>
                )}
                {!selectionMode && !readOnly && <button
                    ref={draggable.setActivatorNodeRef}
                    type="button"
                    aria-label={`Kéo câu ${index + 1}`}
                    title={`Kéo câu ${index + 1}`}
                    className="grid h-11 w-8 shrink-0 cursor-grab place-items-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
                    {...draggable.listeners}
                    {...draggable.attributes}
                >
                    <GripVertical className="h-4 w-4" />
                </button>}
                <button
                    type="button"
                    onClick={selectionMode ? onToggleBulk : onSelect}
                    aria-label={`Chọn câu ${index + 1}: ${getQuestionNavigatorLabel(question)}`}
                    className="flex min-w-0 flex-1 items-start gap-2 rounded-lg p-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-semibold">
                        {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-medium text-slate-800">
                            {getQuestionNavigatorLabel(question)}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                            {question.type} • {question.points ?? 0} điểm
                        </span>
                    </span>
                </button>
            </div>

            {!selectionMode && !readOnly && <div className="mt-1 flex items-center justify-end gap-1 border-t border-slate-100 pt-1">
                <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMove(-1)}
                    aria-label={`Di chuyển câu ${index + 1} lên`}
                    title="Di chuyển lên"
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <ArrowUp className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    disabled={index === total - 1}
                    onClick={() => onMove(1)}
                    aria-label={`Di chuyển câu ${index + 1} xuống`}
                    title="Di chuyển xuống"
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                    <ArrowDown className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onDuplicate}
                    aria-label={`Nhân bản câu ${index + 1}`}
                    title="Nhân bản câu hỏi"
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-700"
                >
                    <Copy className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Xóa câu ${index + 1}`}
                    title="Xóa câu hỏi"
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>}
        </article>
    );
};

export default React.memo(QuestionNavigatorItem);
