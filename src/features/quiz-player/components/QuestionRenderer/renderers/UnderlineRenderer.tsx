import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';

const UnderlineRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const words = (question as any).words || [];
  const rawAnswer = answers[question.id];
  const selectedIndexes: number[] = Array.isArray(rawAnswer) ? rawAnswer : [];

  const handleToggle = (index: number) => {
    const newSelection = selectedIndexes.includes(index)
      ? selectedIndexes.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedIndexes, index].sort((left, right) => left - right);
    onAnswerChange(question.id, newSelection);
  };

  if (!words || words.length === 0) {
    return (
      <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        Câu hỏi gạch chân chưa có danh sách từ để chọn.
      </div>
    );
  }

  return (
    <div className="underline-renderer-container pt-2">
      <div className="flex min-h-[160px] flex-wrap items-center justify-center gap-x-2 gap-y-4 rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-6 md:p-8">
        {words.map((word: string, index: number) => {
          const isSelected = selectedIndexes.includes(index);

          return (
            <button
              key={index}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleToggle(index)}
              className={`rounded-[8px] border px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-sky-300'
              }`}
            >
              <MathSpan
                content={word}
                className={`text-lg font-medium md:text-xl ${
                  isSelected ? 'underline decoration-2 decoration-emerald-500 underline-offset-8' : ''
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="text-center text-sm leading-6 text-[#526174]">
          Nhấn vào từ hoặc cụm từ em muốn gạch chân.
        </p>
        {selectedIndexes.length > 0 ? (
          <button
            type="button"
            onClick={() => onAnswerChange(question.id, [])}
            className="min-h-10 rounded-[8px] px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#E76F51]"
          >
            Xóa tất cả gạch chân
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(UnderlineRenderer);
