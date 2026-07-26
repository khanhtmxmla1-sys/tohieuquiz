import React from 'react';
import { BaseRendererProps } from '../types';
import LatexDropdown from '../atoms/LatexDropdown';

const MathRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const mathType = (question as any).mathType;

  if (mathType === 'fraction') {
    const value = answers[question.id] || { numerator: '', denominator: '' };
    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col items-center">
          <input
            type="text"
            value={value.numerator || ''}
            onChange={(event) => onAnswerChange(question.id, { ...value, numerator: event.target.value })}
            className="h-12 w-16 rounded-[8px] border border-slate-300 bg-white text-center text-xl font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="?"
          />
          <div className="my-2 h-0.5 w-20 bg-slate-700" />
          <input
            type="text"
            value={value.denominator || ''}
            onChange={(event) => onAnswerChange(question.id, { ...value, denominator: event.target.value })}
            className="h-12 w-16 rounded-[8px] border border-slate-300 bg-white text-center text-xl font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="?"
          />
        </div>
      </div>
    );
  }

  if (mathType === 'math_dropdown') {
    const options = (question as any).options || [];
    return (
      <div className="flex justify-center p-4">
        <LatexDropdown
          options={options}
          value={answers[question.id] || ''}
          onChange={(value) => onAnswerChange(question.id, value)}
          placeholder="-- Chọn đáp án --"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center p-4">
      <input
        type="text"
        value={answers[question.id] || ''}
        onChange={(event) => onAnswerChange(question.id, event.target.value)}
        placeholder="Nhập kết quả..."
        className="w-48 rounded-[10px] border border-slate-300 bg-white p-4 text-center text-2xl font-semibold text-slate-800 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </div>
  );
};

export default React.memo(MathRenderer);
