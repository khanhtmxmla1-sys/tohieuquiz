import React from 'react';
import { BaseRendererProps } from '../types';
import { answerInputClasses } from '../../answer-state/stateStyles';

const ShortAnswerRenderer: React.FC<BaseRendererProps> = ({
  question,
  answers,
  onAnswerChange,
}) => {
  const value = String(answers[question.id] ?? '');

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={(event) => onAnswerChange(question.id, event.target.value)}
        placeholder="Nhập câu trả lời của em..."
        className={`w-full rounded-[10px] border p-4 text-base outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 md:text-lg ${answerInputClasses(Boolean(value.trim()))}`}
      />
      <p className="text-xs leading-5 text-slate-500">
        Kiểm tra lại chính tả trước khi chuyển sang câu tiếp theo.
      </p>
    </div>
  );
};

export default React.memo(ShortAnswerRenderer);
