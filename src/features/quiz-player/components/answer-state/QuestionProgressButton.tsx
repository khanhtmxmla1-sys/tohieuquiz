import React from 'react';
import type { QuestionProgressState } from '../../../../domain/quiz-progress';
import { progressButtonClasses } from './stateStyles';

interface QuestionProgressButtonProps {
  questionNumber: number;
  state: QuestionProgressState;
  active: boolean;
  onClick(): void;
}

const QuestionProgressButton: React.FC<QuestionProgressButtonProps> = ({
  questionNumber,
  state,
  active,
  onClick,
}) => (
  <button
    type="button"
    aria-label={`Đi đến câu ${questionNumber}`}
    aria-current={active ? 'step' : undefined}
    onClick={onClick}
    className={`relative flex aspect-square w-full items-center justify-center rounded-[8px] border-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${progressButtonClasses[state]} ${active ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`}
  >
    <span>{questionNumber}</span>
    {state === 'complete' ? (
      <span className="absolute right-0.5 top-0 text-[9px] font-black leading-none">✓</span>
    ) : null}
    {state === 'partial' ? (
      <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-amber-600" />
    ) : null}
  </button>
);

export default React.memo(QuestionProgressButton);
