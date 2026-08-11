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
    const storedRecord = storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)
      ? storedValue as FractionAnswer
      : { numerator: '', denominator: '' };
    const canonicalValue = storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)
      ? String((storedValue as Record<string, unknown>).value ?? '')
      : '';
    const [canonicalNumerator = '', canonicalDenominator = ''] = canonicalValue.split('/', 2);
    const numerator = String(storedRecord.numerator ?? canonicalNumerator);
    const denominator = String(storedRecord.denominator ?? canonicalDenominator);
    const numeratorId = `math-numerator-${question.id}`;
    const denominatorId = `math-denominator-${question.id}`;
    const updateFraction = (nextNumerator: string, nextDenominator: string) => {
      onAnswerChange(question.id, {
        type: 'SHORT_ANSWER',
        value: nextNumerator || nextDenominator ? `${nextNumerator}/${nextDenominator}` : '',
        numerator: nextNumerator,
        denominator: nextDenominator,
      });
    };

    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col items-center">
          <label htmlFor={numeratorId} className="sr-only">Tử số</label>
          <input
            id={numeratorId}
            type="text"
            value={numerator}
            onChange={(event) => updateFraction(event.target.value, denominator)}
            className={`h-12 w-16 rounded-[8px] border text-center text-xl font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(numerator.trim()))}`}
            placeholder="?"
          />
          <div className="my-2 h-0.5 w-20 bg-slate-700" />
          <label htmlFor={denominatorId} className="sr-only">Mẫu số</label>
          <input
            id={denominatorId}
            type="text"
            value={denominator}
            onChange={(event) => updateFraction(numerator, event.target.value)}
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
  const resultId = `math-result-${question.id}`;
  return (
    <div className="flex justify-center p-4">
      <label htmlFor={resultId} className="sr-only">Kết quả toán học</label>
      <input
        id={resultId}
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
