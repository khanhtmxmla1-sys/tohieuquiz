import React from 'react';
import { BaseRendererProps } from '../types';

const ShortAnswerRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => (
  <div className="space-y-3">
    <input
      type="text"
      value={answers[question.id] || ''}
      onChange={(event) => onAnswerChange(question.id, event.target.value)}
      placeholder="Nhập câu trả lời của em..."
      className="w-full rounded-[10px] border border-slate-300 bg-white p-4 text-base text-slate-800 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 md:text-lg"
    />
    <p className="text-xs leading-5 text-slate-500">
      Kiểm tra lại chính tả trước khi chuyển sang câu tiếp theo.
    </p>
  </div>
);

export default React.memo(ShortAnswerRenderer);
