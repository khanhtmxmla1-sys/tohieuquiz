import React from 'react';
import type { BaseRendererProps } from '../types';
import SmartText from '../utils/SmartText';
import { answerInputClasses } from '../../answer-state/stateStyles';

interface ErrorCorrectionAnswer {
  wrongWord: string;
  correctWord: string;
}

const ErrorCorrectionRenderer: React.FC<BaseRendererProps> = ({ question, answers, onAnswerChange }) => {
  const passage = String((question as any).passage ?? (question as any).text ?? '');
  const current = answers[question.id] && typeof answers[question.id] === 'object'
    ? answers[question.id] as Partial<ErrorCorrectionAnswer>
    : {};
  const value: ErrorCorrectionAnswer = {
    wrongWord: String(current.wrongWord ?? ''),
    correctWord: String(current.correctWord ?? ''),
  };

  const update = (field: keyof ErrorCorrectionAnswer, fieldValue: string) => {
    onAnswerChange(question.id, { ...value, [field]: fieldValue });
  };

  return (
    <div className="space-y-5">
      {passage ? (
        <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4 leading-7 text-slate-800">
          <SmartText content={passage} />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-slate-700">Từ viết sai</span>
          <input
            aria-label="Từ viết sai"
            type="text"
            value={value.wrongWord}
            onChange={(event) => update('wrongWord', event.target.value)}
            className={`h-12 w-full rounded-[10px] border px-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(value.wrongWord.trim()))}`}
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-slate-700">Từ sửa đúng</span>
          <input
            aria-label="Từ sửa đúng"
            type="text"
            value={value.correctWord}
            onChange={(event) => update('correctWord', event.target.value)}
            className={`h-12 w-full rounded-[10px] border px-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(value.correctWord.trim()))}`}
          />
        </label>
      </div>
    </div>
  );
};

export default React.memo(ErrorCorrectionRenderer);
