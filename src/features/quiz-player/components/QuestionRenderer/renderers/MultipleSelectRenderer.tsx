import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';
import { optionIdAt, selectedOptionIds } from '../utils/answerState';

const MultipleSelectRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const options = (question as any).options ?? [];
  const currentOptionIds = selectedOptionIds(question, answers[question.id]);

  return (
    <div className="grid grid-cols-1 gap-3">
      {options.map((option: unknown, index: number) => {
        const label = String.fromCharCode(65 + index);
        const optionId = optionIdAt(index);
        const isSelected = currentOptionIds.includes(optionId);

        return (
          <button
            key={index}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              const optionIds = isSelected
                ? currentOptionIds.filter((answerId) => answerId !== optionId)
                : [...currentOptionIds, optionId].sort();
              onAnswerChange(question.id, { type: 'MULTIPLE_SELECT', optionIds });
            }}
            className={`flex min-h-14 items-center rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              isSelected
                ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                : 'border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-slate-50'
            }`}
          >
            <span
              className={`mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border text-xs font-semibold ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {label}
            </span>
            <MathSpan
              content={typeof option === 'string' ? option.replace(/^[A-Za-z][.)]\s*/, '') : String(option)}
              className="flex-1"
            />
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(MultipleSelectRenderer);
