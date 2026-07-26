import React from 'react';
import { Sparkles, Tag } from 'lucide-react';
import { QuestionReview } from '../../../../common';
import type { DisplayQuestion } from '../models/questionModel';

interface QuestionDetailPanelProps {
    selectedQuestion: DisplayQuestion | null;
    selectedQuestionIndex: number;
    filteredQuestionCount: number;
    displayQuestionCount: number;
    onQuestionSelect: React.Dispatch<React.SetStateAction<number>>;
}

export const QuestionDetailPanel: React.FC<QuestionDetailPanelProps> = (props) => (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50/60 custom-scrollbar">
        {props.selectedQuestion ? (
            <div className="mx-auto w-full max-w-6xl">
                <div className="flex items-center gap-2 mb-4 text-xs text-slate-400 font-medium">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Câu {props.selectedQuestion.index + 1}</span>
                    <span className="text-slate-300">/</span>
                    <span>{props.displayQuestionCount} câu</span>
                    <span className="ml-auto rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200">
                        {props.selectedQuestion.isCorrect === true ? 'Đúng' : props.selectedQuestion.isCorrect === false ? 'Sai' : 'Bỏ qua'}
                    </span>
                </div>
                <QuestionReview
                    index={props.selectedQuestion.index}
                    question={props.selectedQuestion}
                    studentAnswer={props.selectedQuestion.selectedAnswer}
                    status={props.selectedQuestion.isCorrect === true ? 'correct' : props.selectedQuestion.isCorrect === false ? 'wrong' : 'skipped'}
                    showExplanation={true}
                />
                <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-white bg-white/80 p-3 shadow-lg shadow-slate-200/60 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <button
                        disabled={props.selectedQuestionIndex === 0}
                        onClick={() => props.onQuestionSelect((index) => Math.max(0, index - 1))}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        ← Câu trước
                    </button>
                    <span className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
                        Câu {props.selectedQuestionIndex + 1} / {props.filteredQuestionCount}
                    </span>
                    <button
                        disabled={props.selectedQuestionIndex >= props.filteredQuestionCount - 1}
                        onClick={() => props.onQuestionSelect((index) => Math.min(props.filteredQuestionCount - 1, index + 1))}
                        className={`rounded-2xl border px-5 py-3 text-sm font-black transition-all ${
                            props.selectedQuestionIndex >= props.filteredQuestionCount - 1
                                ? 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-500 shadow-none'
                                : 'border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700'
                        }`}
                    >
                        Câu sau →
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Sparkles className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-sm">Chọn câu hỏi ở bên trái để xem chi tiết</p>
            </div>
        )}
    </div>
);
