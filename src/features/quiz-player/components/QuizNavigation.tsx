import React from 'react';
import { Question } from '../../../types';
import type { QuestionProgressResult, QuestionProgressState } from '../../../domain/quiz-progress';
import type { QuizPageChangeHandler } from '../hooks/useQuizPageNavigation';
import { QuestionProgressButton, progressButtonClasses } from './answer-state';

interface QuizNavigationProps {
  questions: Question[];
  progressByQuestionId: Record<string, QuestionProgressResult>;
  activeQuestionId: string | null;
  QUESTIONS_PER_PAGE: number;
  onPageChange: QuizPageChangeHandler;
}

const EMPTY_PROGRESS: QuestionProgressResult = {
  state: 'empty',
  hasInteraction: false,
  completedParts: 0,
  requiredParts: 1,
};

const LEGEND_ITEMS: Array<{ state: QuestionProgressState; label: string }> = [
  { state: 'empty', label: 'Chưa trả lời' },
  { state: 'partial', label: 'Đang làm' },
  { state: 'complete', label: 'Đã hoàn thành' },
];

const QuizNavigation: React.FC<QuizNavigationProps> = ({
  questions,
  progressByQuestionId,
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
          const progress = progressByQuestionId[question.id] ?? EMPTY_PROGRESS;
          const pageOfQuestion = Math.floor(index / QUESTIONS_PER_PAGE) + 1;
          return (
            <QuestionProgressButton
              key={question.id}
              questionNumber={index + 1}
              state={progress.state}
              active={question.id === activeQuestionId}
              onClick={() => handleQuestionClick(question, pageOfQuestion)}
            />
          );
        })}
      </div>

      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
        {LEGEND_ITEMS.map(({ state, label }) => (
          <div key={state} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-[3px] border ${progressButtonClasses[state]}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizNavigation;
