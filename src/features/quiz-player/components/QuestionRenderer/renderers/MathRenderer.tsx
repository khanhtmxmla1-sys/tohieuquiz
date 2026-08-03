import React from 'react';
import { BaseRendererProps } from '../types';
import LatexDropdown from '../atoms/LatexDropdown';
import { answerInputClasses } from '../../answer-state/stateStyles';

interface FractionAnswer {
  numerator?: string;
  denominator?: string;
}

const MathRenderer: React.FC<BaseRendererProps> = ({
  question,
  answers,
  onAnswerChange,
}) => {
  const mathType = (question as any).mathType;

  if (mathType === 'fraction') {
    const storedValue = answers[question.id];
    const value: FractionAnswer = storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)
      ? storedValue as FractionAnswer
      : { numerator: '', denominator: '' };
    const numerator = String(value.numerator ?? '');
    const denominator = String(value.denominator ?? '');

    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col items-center">
          <input
            type="text"
            value={numerator}
            onChange={(event) => onAnswerChange(question.id, { ...value, numerator: event.target.value })}
            className={`h-12 w-16 rounded-[8px] border text-center text-xl font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(numerator.trim()))}`}
            placeholder="?"
          />
          <div className="my-2 h-0.5 w-20 bg-slate-700" />
          <input
            type="text"
            value={denominator}
            onChange={(event) => onAnswerChange(question.id, { ...value, denominator: event.target.value })}
            className={`h-12 w-16 rounded-[8px] border text-center text-xl font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(denominator.trim()))}`}
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
          value={String(answers[question.id] ?? '')}
          onChange={(value) => onAnswerChange(question.id, value)}
          placeholder="-- Chọn đáp án --"
        />
      </div>
    );
  }

  const value = String(answers[question.id] ?? '');
  return (
    <div className="flex justify-center p-4">
      <input
        type="text"
        value={value}
        onChange={(event) => onAnswerChange(question.id, event.target.value)}
        placeholder="Nhập kết quả..."
        className={`w-48 rounded-[10px] border p-4 text-center text-2xl font-semibold outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(value.trim()))}`}
      />
    </div>
  );
};

export default React.memo(MathRenderer);
