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
  contained?: boolean;
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
  contained = false,
}) => {
  const handleQuestionClick = (question: Question, page: number) => {
    onPageChange(page, question.id);
  };

  const rootClassName = contained
    ? 'flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white p-4'
    : 'sticky top-24 rounded-[14px] border border-[#E5E7EB] bg-white p-4';

  const questionListClassName = contained
    ? 'mt-4 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
    : 'mt-4';

  return (
    <div className={rootClassName}>
      <h2 className="shrink-0 text-sm font-semibold text-[#172033]">Danh sách câu hỏi</h2>
      <p className="mt-1 shrink-0 text-xs leading-5 text-[#526174]">Chọn số câu để chuyển nhanh.</p>

      <div aria-label="Danh sách số câu" className={questionListClassName}>
        <div className="grid grid-cols-5 gap-2">
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
      </div>

      <div className="mt-5 shrink-0 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
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
