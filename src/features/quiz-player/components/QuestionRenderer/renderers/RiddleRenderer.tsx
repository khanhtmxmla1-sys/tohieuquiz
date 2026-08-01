import React from 'react';
import type { BaseRendererProps } from '../types';
import SmartText from '../utils/SmartText';

const RiddleRenderer: React.FC<BaseRendererProps> = ({ question, answers, onAnswerChange }) => {
  const lines = Array.isArray((question as any).riddleLines)
    ? (question as any).riddleLines
    : Array.isArray((question as any).items)
      ? (question as any).items
      : [];
  const hint = String((question as any).hint ?? (question as any).sentence ?? '');
  const value = String(answers[question.id] ?? '');

  return (
    <div className="space-y-4">
      {lines.length > 0 ? (
        <div className="space-y-2 rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-slate-800">
          {lines.map((line: unknown, index: number) => <p key={index}><SmartText content={String(line)} /></p>)}
        </div>
      ) : null}
      {hint ? <p className="text-sm text-slate-500">Gợi ý: <SmartText content={hint} /></p> : null}
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-slate-700">Đáp án</span>
        <input
          aria-label="Đáp án câu đố"
          type="text"
          value={value}
          onChange={(event) => onAnswerChange(question.id, event.target.value)}
          className="h-12 w-full rounded-[10px] border border-slate-300 bg-white px-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          placeholder="Nhập đáp án của em"
        />
      </label>
    </div>
  );
};

export default React.memo(RiddleRenderer);
