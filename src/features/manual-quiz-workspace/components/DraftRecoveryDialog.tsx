import React from 'react';
import { Clock3, FileQuestion, RotateCcw, Trash2 } from 'lucide-react';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';

interface DraftRecoveryDialogProps {
    draft: ManualQuizDraftEnvelope;
    onContinue(): void;
    onDiscard(): void;
}

const formatSavedAt = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'không rõ thời gian';
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
};

const DraftRecoveryDialog: React.FC<DraftRecoveryDialogProps> = ({
    draft,
    onContinue,
    onDiscard,
}) => (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-recovery-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
            <div className="mb-5 flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
                    <RotateCcw className="h-6 w-6" />
                </div>
                <div>
                    <h2 id="draft-recovery-title" className="text-xl font-semibold text-slate-900">
                        Tiếp tục bản nháp chưa hoàn thành?
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        Hệ thống tìm thấy nội dung đã tự động lưu trên thiết bị này.
                    </p>
                </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="flex items-start gap-2 font-semibold text-slate-800">
                    <FileQuestion className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <span>{draft.quiz.title}</span>
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    Đã lưu {formatSavedAt(draft.updatedAt)} • {draft.quiz.questions.length} câu hỏi
                </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onDiscard}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-rose-200 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                    <Trash2 className="h-4 w-4" /> Bỏ bản nháp
                </button>
                <button
                    type="button"
                    onClick={onContinue}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                    <RotateCcw className="h-4 w-4" /> Tiếp tục soạn
                </button>
            </div>
        </section>
    </div>
);

export default DraftRecoveryDialog;
