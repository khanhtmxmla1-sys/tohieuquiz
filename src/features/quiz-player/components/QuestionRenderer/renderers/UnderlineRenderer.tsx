import React from 'react';
import { BaseRendererProps } from '../types';
import { UnderlineSentence } from '../../../../../components/common/UnderlineSentence';

const UnderlineRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const words = Array.isArray((question as any).words)
    ? (question as any).words.map(String)
    : [];
  const sentence = typeof (question as any).sentence === 'string'
    ? (question as any).sentence
    : undefined;
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
      <div className="rounded-[10px] border border-slate-200 bg-white p-4 text-[17px] leading-8 sm:p-5 sm:text-lg">
        <UnderlineSentence
          sentence={sentence}
          words={words}
          interactive
          stateForIndex={(index) => (selectedIndexes.includes(index) ? 'selected' : 'idle')}
          onToggle={handleToggle}
          ariaLabel="Đoạn văn để gạch chân"
        />
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="text-center text-sm leading-6 text-[#526174]">
          Em hãy nhấn vào từ hoặc cụm từ cần gạch chân.
        </p>
        {selectedIndexes.length > 0 ? (
          <button
            type="button"
            onClick={() => onAnswerChange(question.id, [])}
            className="min-h-11 rounded-[8px] px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#E76F51]"
          >
            Xóa tất cả gạch chân
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(UnderlineRenderer);
