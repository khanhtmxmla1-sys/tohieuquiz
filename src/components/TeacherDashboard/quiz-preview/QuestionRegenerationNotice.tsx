import React from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import type { Question } from '../../../types';
import type { QuestionRegenerationChange } from './useQuestionRegeneration';

interface QuestionRegenerationNoticeProps {
    change: QuestionRegenerationChange;
    onUndo: () => void;
    onDismiss: () => void;
}

const summarizeQuestion = (question: Question): string => {
    const record = question as unknown as Record<string, unknown>;
    const value = [
        record.question,
        record.mainQuestion,
        record.sentence,
        record.text,
        record.passage,
    ].find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (typeof value === 'string') return value.trim().slice(0, 180);
    if (Array.isArray(record.riddleLines)) {
        return record.riddleLines.map(String).join(' ').trim().slice(0, 180);
    }
    return `Câu hỏi ${question.id}`;
};

const QuestionRegenerationNotice: React.FC<QuestionRegenerationNoticeProps> = ({
    change,
    onUndo,
    onDismiss,
}) => (
    <section
        className="rounded-xl border border-violet-200 bg-violet-50 p-4"
        aria-labelledby="regeneration-change-title"
    >
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <h4 id="regeneration-change-title" className="flex items-center gap-2 font-bold text-violet-900">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    AI đã thay đổi một câu hỏi
                </h4>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-violet-100 bg-white p-3">
                        <dt className="font-semibold text-slate-500">Trước</dt>
                        <dd className="mt-1 text-slate-800">{summarizeQuestion(change.before)}</dd>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                        <dt className="font-semibold text-violet-700">Sau</dt>
                        <dd className="mt-1 text-slate-900">{summarizeQuestion(change.after)}</dd>
                    </div>
                </dl>
            </div>
            <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Đóng so sánh thay đổi"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
        <button
            type="button"
            onClick={onUndo}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Hoàn tác lần sinh lại này
        </button>
    </section>
);

export default QuestionRegenerationNotice;
