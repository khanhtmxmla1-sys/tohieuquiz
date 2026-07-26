import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, Upload } from 'lucide-react';
import { QuestionType } from '../../../types';
import { createManualQuestionDraft, QUESTION_TYPE_OPTIONS } from '../../../components/TeacherDashboard/quiz-preview/questionTypes';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import type { QuestionImportCandidate, QuestionImportResult } from './questionImport.types';

interface QuestionImportReviewProps {
    result: QuestionImportResult;
    onImport: (questions: ManualQuizQuestion[]) => void;
}

const questionText = (question: ManualQuizQuestion): string => {
    const loose = question as ManualQuizQuestion & { mainQuestion?: string; question?: string };
    return loose.mainQuestion || loose.question || '[Chưa có nội dung]';
};

const getAnswer = (question: ManualQuizQuestion): string => {
    const loose = question as ManualQuizQuestion & { correctAnswer?: string; correctAnswers?: string[] };
    return Array.isArray(loose.correctAnswers) ? loose.correctAnswers.join(', ') : String(loose.correctAnswer || '');
};

const setAnswer = (question: ManualQuizQuestion, value: string): ManualQuizQuestion => {
    if (question.type === QuestionType.MULTIPLE_SELECT) {
        return {
            ...question,
            correctAnswers: value.split(/[;,]/).map((item) => item.trim()).filter(Boolean),
        } as ManualQuizQuestion;
    }
    return { ...question, correctAnswer: value } as ManualQuizQuestion;
};

const convertQuestionType = (question: ManualQuizQuestion, type: QuestionType): ManualQuizQuestion => {
    if (question.type === type) return question;
    const starter = createManualQuestionDraft(type) as ManualQuizQuestion;
    return {
        ...starter,
        id: question.id,
        question: questionText(question),
        difficulty: question.difficulty,
        points: question.points,
        explanation: question.explanation,
        subject: question.subject,
        image: question.image,
        imageAlt: question.imageAlt,
    } as ManualQuizQuestion;
};

const ReviewCard: React.FC<{
    candidate: QuestionImportCandidate;
    selected: boolean;
    selectable: boolean;
    onToggle: () => void;
    onChange: (question: ManualQuizQuestion) => void;
}> = ({ candidate, selected, selectable, onToggle, onChange }) => (
    <article className={`rounded-xl border p-4 ${candidate.status === 'accepted'
        ? 'border-emerald-200 bg-emerald-50/30'
        : candidate.status === 'needsReview'
            ? 'border-amber-200 bg-amber-50/30'
            : 'border-rose-200 bg-rose-50/30'}`}
    >
        <div className="flex items-start gap-3">
            <input
                type="checkbox"
                aria-label={`Chọn ${candidate.sourceLabel}`}
                checked={selected}
                disabled={!selectable}
                onChange={onToggle}
                className="mt-1 h-5 w-5 accent-sky-600"
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-slate-900">{candidate.sourceLabel}</strong>
                    <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600">{candidate.status}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{questionText(candidate.question)}</p>
                {candidate.issues.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-amber-800">
                        {candidate.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                )}
                {selectable && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                            Loại câu hỏi
                            <select
                                aria-label={`Loại câu hỏi ${candidate.sourceLabel}`}
                                value={candidate.question.type}
                                onChange={(event) => onChange(convertQuestionType(candidate.question, event.target.value as QuestionType))}
                                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                            >
                                {QUESTION_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                            Đáp án đúng
                            <input
                                aria-label={`Đáp án đúng ${candidate.sourceLabel}`}
                                value={getAnswer(candidate.question)}
                                onChange={(event) => onChange(setAnswer(candidate.question, event.target.value))}
                                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                            />
                        </label>
                    </div>
                )}
            </div>
        </div>
    </article>
);

const QuestionImportReview: React.FC<QuestionImportReviewProps> = ({ result, onImport }) => {
    const initialCandidates = useMemo(() => [...result.accepted, ...result.needsReview, ...result.rejected], [result]);
    const [candidates, setCandidates] = useState(initialCandidates);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(result.accepted.map((candidate) => candidate.id)));
    const selectedQuestions = candidates
        .filter((candidate) => selectedIds.has(candidate.id) && candidate.status !== 'rejected')
        .map((candidate) => candidate.question);

    const updateQuestion = (id: string, question: ManualQuizQuestion) => {
        setCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, question } : candidate));
    };
    const toggle = (id: string) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const sections = [
        { status: 'accepted', title: 'Nhập được', icon: CheckCircle2 },
        { status: 'needsReview', title: 'Cần rà soát', icon: AlertTriangle },
        { status: 'rejected', title: 'Không thể nhập', icon: FileWarning },
    ] as const;

    return (
        <div className="space-y-6">
            {sections.map(({ status, title, icon: Icon }) => {
                const items = candidates.filter((candidate) => candidate.status === status);
                if (items.length === 0) return null;
                return (
                    <section key={status} aria-label={title}>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon className="h-4 w-4" /> {title} ({items.length})</h3>
                        <div className="space-y-3">
                            {items.map((candidate) => (
                                <ReviewCard
                                    key={candidate.id}
                                    candidate={candidate}
                                    selected={selectedIds.has(candidate.id)}
                                    selectable={status !== 'rejected'}
                                    onToggle={() => toggle(candidate.id)}
                                    onChange={(question) => updateQuestion(candidate.id, question)}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
            <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white py-4">
                <button
                    type="button"
                    disabled={selectedQuestions.length === 0}
                    onClick={() => onImport(selectedQuestions)}
                    aria-label={`Nhập ${selectedQuestions.length} câu đã chọn`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Upload className="h-4 w-4" /> Nhập {selectedQuestions.length} câu đã chọn
                </button>
            </div>
        </div>
    );
};

export default QuestionImportReview;
