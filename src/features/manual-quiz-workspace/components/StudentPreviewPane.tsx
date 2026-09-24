import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import QuestionRenderer from '../../quiz-player/components/QuestionRenderer';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';

interface StudentPreviewPaneProps {
    question?: ManualQuizQuestion | null;
    questionIndex?: number;
    onBack?(): void;
    readOnly?: boolean;
}

const StudentPreviewPane: React.FC<StudentPreviewPaneProps> = ({
    question: providedQuestion,
    questionIndex = 0,
    onBack,
    readOnly = false,
}) => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const selectedQuestion = envelope?.quiz.questions.find((question) => question.id === envelope.selectedQuestionId) ?? null;
    const question = providedQuestion === undefined ? selectedQuestion : providedQuestion;
    const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});

    useEffect(() => {
        setPreviewAnswers({});
    }, [question?.id]);

    const onAnswerChange = useCallback((questionId: string, value: any, subId?: string) => {
        setPreviewAnswers((current) => {
            const existing = current[questionId];
            const nextValue = subId
                ? {
                    ...((existing && typeof existing === 'object') ? existing : {}),
                    [subId]: value,
                }
                : value;
            return { ...current, [questionId]: nextValue };
        });
    }, []);

    const onMatchingClick = useCallback((questionId: string, item: string, type: 'left' | 'right') => {
        setPreviewAnswers((current) => {
            const existing = current[questionId] && typeof current[questionId] === 'object'
                ? { ...current[questionId] }
                : {};
            if (type === 'left') {
                return {
                    ...current,
                    [questionId]: { ...existing, selectedLeft: item },
                };
            }
            const selectedLeft = existing.selectedLeft;
            if (!selectedLeft) return current;

            Object.entries(existing).forEach(([leftId, rightId]) => {
                if (leftId !== 'selectedLeft' && leftId !== '__shuffledIds' && rightId === item) {
                    delete existing[leftId];
                }
            });
            delete existing.selectedLeft;
            existing[selectedLeft] = item;
            return { ...current, [questionId]: existing };
        });
    }, []);

    return (
        <main
            aria-label="Xem trước học sinh"
            className="flex min-h-0 w-full min-w-0 flex-col overflow-y-auto bg-[#FFFDF7]"
        >
            <div className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:px-6">
                <div>
                    <h2 className="text-lg font-semibold text-[#172033]">Xem trước học sinh</h2>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> Desktop
                        <span aria-hidden="true">•</span>
                        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> Mobile
                    </div>
                </div>
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {readOnly ? 'Về danh sách' : 'Quay lại sửa'}
                    </button>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-[1120px]">
                    {!question ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                            Thêm hoặc chọn một câu hỏi để xem trước.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                            <p className="mb-3 px-2 text-sm font-semibold text-slate-500">Bản xem trước, không ghi nhận câu trả lời</p>
                            <QuestionRenderer
                                quizId={envelope?.quiz.id}
                                question={question}
                                index={questionIndex}
                                answers={previewAnswers}
                                onAnswerChange={onAnswerChange}
                                onMatchingClick={onMatchingClick}
                            />
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default StudentPreviewPane;
