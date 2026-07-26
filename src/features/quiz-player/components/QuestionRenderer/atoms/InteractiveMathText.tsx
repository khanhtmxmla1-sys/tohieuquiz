import React from 'react';
import MathSpan from './MathSpan';
import { normalizeMathText, splitMathSegments } from '../../../../../utils/mathText';

interface InteractiveMathTextProps {
  content: unknown;
  renderBlank: (blankId: string, key: React.Key) => React.ReactNode;
  className?: string;
}

const OPEN = '\uE000';
const CLOSE = '\uE001';
const BLANK_PATTERN = new RegExp(`${OPEN}([^${CLOSE}]+)${CLOSE}`, 'g');

const isLatexOptionalBracket = (input: string, index: number): boolean => {
  if (index > 0 && input[index - 1] === '\\') return true;
  const prefix = input.slice(Math.max(0, index - 20), index);
  return /\\sqrt\s*$/.test(prefix);
};

export const getInteractiveBlankIds = (input: string): string[] => {
  let sequential = 0;
  const ids: string[] = [];
  for (const match of String(input ?? '').matchAll(/\[([^\]]+)\]/g)) {
    if (isLatexOptionalBracket(String(input ?? ''), match.index ?? 0)) continue;
    const trimmed = match[1].trim();
    ids.push(/^\d+$/.test(trimmed) ? trimmed : String(sequential++));
  }
  return ids;
};

const encodeBlanks = (input: string): string => {
  let sequential = 0;
  return input.replace(/\[([^\]]+)\]/g, (full, raw: string, index: number) => {
    if (isLatexOptionalBracket(input, index)) return full;
    const trimmed = raw.trim();
    const id = /^\d+$/.test(trimmed) ? trimmed : String(sequential++);
    return `${OPEN}${id}${CLOSE}`;
  });
};

interface GroupResult {
  content: string;
  end: number;
}

const readBracedGroup = (value: string, start: number): GroupResult | null => {
  if (value[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < value.length; i++) {
    if (value[i] === '{') depth++;
    if (value[i] === '}') {
      depth--;
      if (depth === 0) return { content: value.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
};

const hasBlank = (value: string): boolean => value.includes(OPEN);

const renderBlankTokens = (
  value: string,
  keyPrefix: string,
  renderBlank: InteractiveMathTextProps['renderBlank'],
): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  BLANK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLANK_PATTERN.exec(value)) !== null) {
    if (match.index > last) nodes.push(value.slice(last, match.index));
    nodes.push(
      <React.Fragment key={`${keyPrefix}-blank-${match.index}`}>
        {renderBlank(match[1], `${keyPrefix}-blank-${match.index}`)}
      </React.Fragment>,
    );
    last = BLANK_PATTERN.lastIndex;
  }
  if (last < value.length) nodes.push(value.slice(last));
  return nodes;
};

const InteractiveMathInner: React.FC<{
  value: string;
  keyPrefix: string;
  renderBlank: InteractiveMathTextProps['renderBlank'];
}> = ({ value, keyPrefix, renderBlank }) => {
  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let sequence = 0;

  const flush = () => {
    if (!buffer) return;
    nodes.push(<MathSpan key={`${keyPrefix}-math-${sequence++}`} content={`$${buffer}$`} />);
    buffer = '';
  };

  for (let i = 0; i < value.length;) {
    if (value[i] === OPEN) {
      const end = value.indexOf(CLOSE, i + 1);
      if (end !== -1) {
        flush();
        const id = value.slice(i + 1, end);
        const blankKey = `${keyPrefix}-blank-${sequence++}`;
        nodes.push(
          <React.Fragment key={blankKey}>
            {renderBlank(id, blankKey)}
          </React.Fragment>,
        );
        i = end + 1;
        continue;
      }
    }

    const commandMatch = value.slice(i).match(/^\\(dfrac|tfrac|frac|sqrt)\s*/);
    if (commandMatch) {
      const command = commandMatch[1];
      let cursor = i + commandMatch[0].length;
      const first = readBracedGroup(value, cursor);
      if (first) {
        cursor = first.end;
        const second = command === 'sqrt' ? null : readBracedGroup(value, cursor);
        const commandEnd = command === 'sqrt' ? first.end : second?.end;
        const containsInteractiveBlank = hasBlank(first.content) || Boolean(second && hasBlank(second.content));

        if (commandEnd && containsInteractiveBlank) {
          flush();
          if (command === 'sqrt') {
            nodes.push(
              <span key={`${keyPrefix}-sqrt-${sequence++}`} data-testid="interactive-sqrt" className="inline-flex items-stretch align-middle mx-1">
                <span className="text-xl leading-none pr-0.5">√</span>
                <span className="border-t border-current px-1 pt-0.5">
                  {hasBlank(first.content)
                    ? <InteractiveMathInner value={first.content} keyPrefix={`${keyPrefix}-sqrt-arg`} renderBlank={renderBlank} />
                    : <MathSpan content={`$${first.content}$`} />}
                </span>
              </span>,
            );
          } else if (second) {
            nodes.push(
              <span key={`${keyPrefix}-fraction-${sequence++}`} data-testid="interactive-fraction" className="inline-flex flex-col align-middle text-center leading-tight mx-1">
                <span className="border-b border-current px-1 min-h-[1.75rem] flex items-center justify-center">
                  {hasBlank(first.content)
                    ? <InteractiveMathInner value={first.content} keyPrefix={`${keyPrefix}-num`} renderBlank={renderBlank} />
                    : <MathSpan content={`$${first.content}$`} />}
                </span>
                <span className="px-1 min-h-[1.5rem] flex items-center justify-center">
                  {hasBlank(second.content)
                    ? <InteractiveMathInner value={second.content} keyPrefix={`${keyPrefix}-den`} renderBlank={renderBlank} />
                    : <MathSpan content={`$${second.content}$`} />}
                </span>
              </span>,
            );
          }
          i = commandEnd;
          continue;
        }
      }
    }

    buffer += value[i];
    i++;
  }

  flush();
  return <>{nodes}</>;
};

const InteractiveMathText: React.FC<InteractiveMathTextProps> = ({ content, renderBlank, className }) => {
  const source = content === null || content === undefined ? '' : String(content);
  const encoded = encodeBlanks(source);
  const normalized = normalizeMathText(encoded);
  const segments = splitMathSegments(normalized);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        const key = `interactive-${index}`;
        if (segment.type === 'math') {
          return hasBlank(segment.inner)
            ? <InteractiveMathInner key={key} value={segment.inner} keyPrefix={key} renderBlank={renderBlank} />
            : <MathSpan key={key} content={segment.raw} />;
        }

        if (!hasBlank(segment.raw)) return <MathSpan key={key} content={segment.raw} />;
        return (
          <React.Fragment key={key}>
            {renderBlankTokens(segment.raw, key, renderBlank).map((node, nodeIndex) =>
              typeof node === 'string'
                ? <MathSpan key={`${key}-text-${nodeIndex}`} content={node} />
                : <React.Fragment key={`${key}-node-${nodeIndex}`}>{node}</React.Fragment>,
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
};

export default React.memo(InteractiveMathText);
