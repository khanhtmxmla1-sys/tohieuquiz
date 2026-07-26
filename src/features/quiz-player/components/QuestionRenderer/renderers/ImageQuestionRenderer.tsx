import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';

const ImageQuestionRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const optionImages: string[] = (question as any).optionImages || [];
  const hasOptionImages = optionImages.some((image: string) => image && image.trim());
  const options = (question as any).options || [];

  return (
    <div className="space-y-4">
      {hasOptionImages ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option: string, index: number) => {
            const label = String.fromCharCode(65 + index);
            const isSelected = answers[question.id] === label;
            const imageUrl = optionImages[index];

            return (
              <button
                key={index}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onAnswerChange(question.id, label)}
                className={`relative flex flex-col overflow-hidden rounded-[10px] border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-sky-300'
                }`}
              >
                <span
                  className={`absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-[7px] border text-xs font-semibold ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white/95 text-slate-600'
                  }`}
                >
                  {label}
                </span>

                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Đáp án ${label}`}
                    className="h-40 w-full bg-slate-50 object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}

                {option && option.trim() ? (
                  <div className={`w-full flex-1 p-3 ${imageUrl ? 'border-t border-slate-100 bg-white' : 'pt-10'}`}>
                    <MathSpan content={option} className="text-sm font-medium text-slate-800" />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {options.map((option: string, index: number) => {
            const label = String.fromCharCode(65 + index);
            const isSelected = answers[question.id] === label;

            return (
              <button
                key={index}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onAnswerChange(question.id, label)}
                className={`flex min-h-14 items-center rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border text-xs font-semibold ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </span>
                <MathSpan content={option} className="flex-1" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(ImageQuestionRenderer);
