import React, { useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowDown,
    ArrowUp,
    Copy,
    GripVertical,
    Trash2,
} from 'lucide-react';
import { QuestionType } from '../../../types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';

export const getQuestionNavigatorLabel = (question: ManualQuizQuestion): string => {
    const data = question as any;
    return String(question.type === QuestionType.TRUE_FALSE ? data.mainQuestion : data.question).trim()
        || 'Câu hỏi chưa có nội dung';
};

interface QuestionNavigatorItemProps {
    question: ManualQuizQuestion;
    index: number;
    total: number;
    selected: boolean;
    selectionMode?: boolean;
    bulkSelected?: boolean;
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
                {!selectionMode && <button
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

            {!selectionMode && <div className="mt-1 flex items-center justify-end gap-1 border-t border-slate-100 pt-1">
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
