import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';
import ChoiceIndicator from '../atoms/ChoiceIndicator';
import { optionIdAt, selectedOptionId } from '../utils/answerState';
import { selectedAnswerClass, unselectedAnswerClass } from '../../answer-state/stateStyles';

const MCQRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
}) => {
  const rawOptions = (question as any).options ?? [];
  const isGrouped = Array.isArray(rawOptions[0]) && rawOptions.length > 0;

  if (isGrouped) {
    return (
      <div className="space-y-7">
        {(rawOptions as any[]).map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            {rawOptions.length > 1 ? (
              <p className="text-sm font-semibold text-slate-500">Nhóm {groupIndex + 1}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {group.map((option: string, optionIndex: number) => {
                const label = String.fromCharCode(65 + optionIndex);
                const answerKey = question.id;
                const isSelected = answers[answerKey] === `${groupIndex}-${label}`;

                return (
                  <button
                    key={optionIndex}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onAnswerChange(answerKey, `${groupIndex}-${label}`)}
                    className={`flex min-h-14 items-center rounded-[12px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                      isSelected
                        ? selectedAnswerClass
                        : unselectedAnswerClass + ' hover:border-sky-300'
                    }`}
                  >
                    <ChoiceIndicator label={label} isSelected={isSelected} />
                    <MathSpan
                      content={typeof option === 'string' ? option.replace(/^[A-Za-z][.)]\s*/, '') : String(option)}
                      className="flex-1"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rawOptions.map((option: unknown, index: number) => {
        const label = String.fromCharCode(65 + index);
        const optionId = optionIdAt(index);
        const isSelected = selectedOptionId(question, answers[question.id]) === optionId;

        return (
          <button
            key={index}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onAnswerChange(question.id, { type: 'MCQ', optionId })}
            className={`group flex min-h-16 items-center rounded-[12px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              isSelected
                ? selectedAnswerClass
                : unselectedAnswerClass + ' hover:border-sky-300'
            }`}
          >
            <ChoiceIndicator label={label} isSelected={isSelected} />
            <div className="min-w-0 flex-1">
              <MathSpan
                content={typeof option === 'string' ? option.replace(/^[A-Za-z][.)]\s*/, '') : String(option)}
                className="block overflow-hidden text-ellipsis font-medium leading-relaxed text-slate-800"
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(MCQRenderer);
