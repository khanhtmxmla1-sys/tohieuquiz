import React from 'react';
import type { BaseRendererProps } from '../types';
import { selectedAnswerClass, unselectedAnswerClass } from '../../answer-state/stateStyles';

const WordScrambleRenderer: React.FC<BaseRendererProps> = ({ question, answers, onAnswerChange }) => {
  const letters = Array.isArray((question as any).letters)
    ? (question as any).letters.map(String)
    : Array.isArray((question as any).items)
      ? (question as any).items.map(String)
      : [];
  const selected = Array.isArray(answers[question.id])
    ? answers[question.id].map(Number).filter(Number.isInteger)
    : [];
  const selectedSet = new Set(selected);

  const toggleLetter = (index: number) => {
    const next = selectedSet.has(index)
      ? selected.filter((selectedIndex: number) => selectedIndex !== index)
      : [...selected, index];
    onAnswerChange(question.id, next);
  };

  return (
    <div className="space-y-5">
      <div className="min-h-14 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-semibold tracking-[0.22em] text-slate-800">
        {selected.map((index: number) => letters[index] ?? '').join('') || 'Chọn các chữ theo thứ tự'}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {letters.map((letter: string, index: number) => {
          const isSelected = selectedSet.has(index);
          return (
            <button
              key={`${letter}-${index}`}
              type="button"
              aria-label={`Chọn chữ ${letter}`}
              aria-pressed={isSelected}
              onClick={() => toggleLetter(index)}
              className={`flex h-12 min-w-12 items-center justify-center rounded-[10px] border px-3 text-lg font-bold transition-colors ${
                isSelected
                  ? selectedAnswerClass
                  : unselectedAnswerClass + ' hover:border-sky-400'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onAnswerChange(question.id, [])}
          className="mx-auto min-h-11 rounded-[8px] px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
        >
          Làm lại
        </button>
      ) : null}
    </div>
  );
};

export default React.memo(WordScrambleRenderer);
