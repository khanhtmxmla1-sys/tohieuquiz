import React from 'react';
import { Question } from '../../../types';
import type { QuizPageChangeHandler } from '../hooks/useQuizPageNavigation';

interface QuizNavigationProps {
  questions: Question[];
  isQuestionAnswered: (question: Question) => boolean;
  activeQuestionId: string | null;
  QUESTIONS_PER_PAGE: number;
  onPageChange: QuizPageChangeHandler;
}

const QuizNavigation: React.FC<QuizNavigationProps> = ({
  questions,
  isQuestionAnswered,
  activeQuestionId,
  QUESTIONS_PER_PAGE,
  onPageChange,
}) => {
  const handleQuestionClick = (question: Question, page: number) => {
    onPageChange(page, question.id);
  };

  return (
    <div className="sticky top-24 rounded-[14px] border border-[#E5E7EB] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#172033]">Danh sách câu hỏi</h2>
      <p className="mt-1 text-xs leading-5 text-[#526174]">Chọn số câu để chuyển nhanh.</p>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {questions.map((question, index) => {
          const isAnswered = isQuestionAnswered(question);
          const pageOfQuestion = Math.floor(index / QUESTIONS_PER_PAGE) + 1;
          const isActive = question.id === activeQuestionId;
          const stateClass = isAnswered
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            : isActive
              ? 'border-sky-500 bg-sky-50 text-sky-800'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50';
          const activeClass = isActive ? 'ring-1 ring-sky-500' : '';

          return (
            <button
              key={question.id}
              type="button"
              aria-label={`Đi đến câu ${index + 1}`}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => handleQuestionClick(question, pageOfQuestion)}
              className={`flex aspect-square w-full items-center justify-center rounded-[8px] border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${stateClass} ${activeClass}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-emerald-300 bg-emerald-50" />
          <span>Đã trả lời</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] border border-slate-200 bg-white" />
          <span>Chưa trả lời</span>
        </div>
      </div>
    </div>
  );
};

export default QuizNavigation;
