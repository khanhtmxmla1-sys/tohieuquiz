import { useId } from 'react';
import {
  buildUnderlineSegments,
  type UnderlineSegment,
} from '../../domain/underline/underlineSentence';
import MathSpan from './MathSpan';

export type UnderlineTokenState =
  | 'idle'
  | 'selected'
  | 'correct'
  | 'incorrect'
  | 'missed';

export interface UnderlineSentenceProps {
  sentence?: string;
  words: string[];
  stateForIndex?: (index: number) => UnderlineTokenState;
  interactive?: boolean;
  onToggle?: (index: number) => void;
  ariaLabel?: string;
}

const stateClass: Record<UnderlineTokenState, string> = {
  idle: 'no-underline',
  selected: 'underline decoration-2 decoration-sky-600 underline-offset-[4px]',
  correct: 'underline decoration-2 decoration-emerald-600 underline-offset-[4px]',
  incorrect: 'underline decoration-2 decoration-red-600 underline-offset-[4px]',
  missed:
    'underline decoration-2 decoration-dotted decoration-emerald-600 underline-offset-[4px]',
};

const interactiveTokenClass =
  'inline appearance-none border-0 bg-transparent p-0 m-0 font-[inherit] leading-[inherit] text-[inherit] align-baseline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

const reviewStatus: Partial<Record<UnderlineTokenState, string>> = {
  selected: 'đã chọn',
  correct: 'đáp án đúng',
  incorrect: 'chọn sai',
  missed: 'đáp án bị bỏ sót',
};

function StatusDescription({ id, state }: { id: string; state: UnderlineTokenState }) {
  const status = reviewStatus[state];
  if (!status) return null;

  return (
    <span id={id} className="sr-only">
      {status}
    </span>
  );
}

function renderPlainToken(
  segment: Extract<UnderlineSegment, { kind: 'token' }>,
  state: UnderlineTokenState,
  statusId: string,
) {
  const status = reviewStatus[state];
  if (!segment.core) {
    return (
      <span key={`punctuation-${segment.index}`}>
        {segment.prefix}
        {segment.suffix}
      </span>
    );
  }

  return (
    <span key={`token-${segment.index}`}>
      {segment.prefix}
      <span
        data-underline-state={state}
        data-underline-index={segment.index}
        className={stateClass[state]}
        aria-describedby={status ? statusId : undefined}
      >
        <MathSpan content={segment.core} />
      </span>
      {segment.suffix}
      <StatusDescription id={statusId} state={state} />
    </span>
  );
}

function renderInteractiveToken(
  segment: Extract<UnderlineSegment, { kind: 'token' }>,
  state: UnderlineTokenState,
  statusId: string,
  onToggle?: (index: number) => void,
) {
  if (!segment.core) {
    return (
      <span key={`punctuation-${segment.index}`}>
        {segment.prefix}
        {segment.suffix}
      </span>
    );
  }

  const status = reviewStatus[state];
  return (
    <span key={`token-${segment.index}`}>
      {segment.prefix}
      <button
        type="button"
        className={`${interactiveTokenClass} ${stateClass[state]}`}
        data-underline-state={state}
        data-underline-index={segment.index}
        aria-pressed={state !== 'idle'}
        aria-describedby={status ? statusId : undefined}
        onClick={() => onToggle?.(segment.index)}
      >
        <MathSpan content={segment.core} />
      </button>
      {segment.suffix}
      <StatusDescription id={statusId} state={state} />
    </span>
  );
}

export function UnderlineSentence({
  sentence,
  words,
  stateForIndex = () => 'idle',
  interactive = false,
  onToggle,
  ariaLabel,
}: UnderlineSentenceProps) {
  const idPrefix = useId();
  const segments = buildUnderlineSegments(sentence, words);
  let tokenPosition = 0;

  return (
    <span className="whitespace-pre-wrap" aria-label={ariaLabel}>
      {segments.map((segment) => {
        if (segment.kind === 'whitespace') {
          return <span key={`whitespace-${tokenPosition}-${segment.text}`}>{segment.text}</span>;
        }

        const index = tokenPosition;
        tokenPosition += 1;
        const state = stateForIndex(segment.index);
        const statusId = `${idPrefix}-status-${index}`;

        return interactive
          ? renderInteractiveToken(segment, state, statusId, onToggle)
          : renderPlainToken(segment, state, statusId);
      })}
    </span>
  );
}
