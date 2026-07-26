import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';

const TrueFalseRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const items = (question as any).items ?? [];

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-[10px] border border-slate-200">
      {items.map((item: any, index: number) => {
        const itemKey = item.id || `item-${index}`;
        const value = answers[question.id]?.[itemKey];

        return (
          <div key={itemKey} className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="mr-4 flex flex-1 gap-2 text-sm leading-6 text-slate-700">
              <span className="font-semibold">{String.fromCharCode(97 + index)}.</span>
              <MathSpan content={item.statement} className="flex-1" />
            </span>
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onAnswerChange(question.id, true, itemKey)}
                aria-pressed={value === true}
                className={`min-h-10 min-w-16 rounded-[8px] border px-3 text-sm font-semibold transition-colors ${
                  value === true
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                Đúng
              </button>
              <button
                type="button"
                onClick={() => onAnswerChange(question.id, false, itemKey)}
                aria-pressed={value === false}
                className={`min-h-10 min-w-16 rounded-[8px] border px-3 text-sm font-semibold transition-colors ${
                  value === false
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                Sai
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(TrueFalseRenderer);
