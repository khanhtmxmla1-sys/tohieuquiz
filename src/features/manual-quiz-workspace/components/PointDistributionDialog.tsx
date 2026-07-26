import React, { useMemo, useRef } from 'react';
import { Calculator, X } from 'lucide-react';
import type { Question } from '../../../types';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

interface PointDistributionDialogProps {
    questions: Question[];
    targetPoints: number;
    onApply(pointsByQuestionId: Record<string, number>): void;
    onClose(): void;
}

export const distributePointsExactly = (
    questions: Question[],
    targetPoints: number,
): Record<string, number> => {
    if (questions.length === 0) return {};
    const totalUnits = Math.max(0, Math.round(targetPoints * 100));
    const baseUnits = Math.floor(totalUnits / questions.length);
    const remainderUnits = totalUnits - baseUnits * questions.length;
    return Object.fromEntries(questions.map((question, index) => [
        question.id,
        (baseUnits + (index < remainderUnits ? 1 : 0)) / 100,
    ]));
};

const PointDistributionDialog: React.FC<PointDistributionDialogProps> = ({
    questions,
    targetPoints,
    onApply,
    onClose,
}) => {
    const dialogRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const proposed = useMemo(
        () => distributePointsExactly(questions, targetPoints),
        [questions, targetPoints],
    );

    useDialogFocusTrap({
        open: true,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
        onEscape: onClose,
    });

    return (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <section
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Chia điểm cho các câu hỏi"
                className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <Calculator className="h-5 w-5 text-sky-600" /> Chia đều điểm
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Tổng mục tiêu: <strong>{targetPoints} điểm</strong> cho {questions.length} câu.
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng chia điểm"
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {questions.map((question, index) => (
                        <div key={question.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                            <span>Câu {index + 1}</span>
                            <strong>{proposed[question.id]} điểm</strong>
                        </div>
                    ))}
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                    Hệ thống phân bổ theo đơn vị 0,01 điểm và bảo đảm tổng cuối cùng đúng chính xác.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-11 rounded-[10px] border border-slate-200 px-4 text-sm font-medium"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={questions.length === 0}
                        onClick={() => onApply(proposed)}
                        className="min-h-11 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Áp dụng chia điểm
                    </button>
                </div>
            </section>
        </div>
    );
};

export default PointDistributionDialog;
