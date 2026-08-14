import React from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';
import { optionIdAt, selectedOptionIds } from '../utils/answerState';
import {
  selectedAnswerClass,
  selectedIndicatorClass,
  unselectedAnswerClass,
  unselectedIndicatorClass,
} from '../../answer-state/stateStyles';
import { buildDisplayEntries } from '../../../../randomization/randomization';

const MultipleSelectRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
  randomizationPolicy,
}) => {
  const options = (question as any).options ?? [];
  const currentOptionIds = selectedOptionIds(question, answers[question.id]);
  const displayOptions = buildDisplayEntries(
    options,
    `${question.id}:choices`,
    randomizationPolicy?.shuffleChoices === true,
  );

  return (
    <div className="grid grid-cols-1 gap-3">
      {displayOptions.map(({ value: option, originalIndex }, displayIndex) => {
        const label = String.fromCharCode(65 + displayIndex);
        const optionId = optionIdAt(originalIndex);
        const isSelected = currentOptionIds.includes(optionId);

        return (
          <button
            key={originalIndex}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              const optionIds = isSelected
                ? currentOptionIds.filter((answerId) => answerId !== optionId)
                : [...currentOptionIds, optionId].sort();
              onAnswerChange(question.id, { type: 'MULTIPLE_SELECT', optionIds });
            }}
            className={`flex min-h-14 items-center rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              isSelected
                ? selectedAnswerClass
                : unselectedAnswerClass + ' hover:border-sky-300'
            }`}
          >
            <span
              className={`mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border text-xs font-semibold ${
                isSelected ? selectedIndicatorClass : unselectedIndicatorClass
              }`}
            >
              {label}
            </span>
            <MathSpan
              content={typeof option === 'string' ? option.replace(/^[A-Za-z][.)]\s*/, '') : String(option)}
              className="flex-1"
            />
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(MultipleSelectRenderer);
