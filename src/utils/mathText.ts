export type MathDelimiter = '$' | '$$' | '\\(' | '\\[';

export interface MathTextSegment {
  type: 'text' | 'math';
  raw: string;
  inner: string;
  start: number;
  end: number;
  delimiter?: MathDelimiter;
  display?: boolean;
}

export interface MathSyntaxIssue {
  code: 'unclosed-delimiter' | 'unexpected-delimiter' | 'unbalanced-braces' | 'malformed-command' | 'unsupported-command';
  message: string;
  index: number;
}

const KNOWN_COMMANDS = [
  'frac', 'dfrac', 'tfrac', 'sqrt', 'times', 'div', 'cdot', 'le', 'leq', 'ge', 'geq',
  'neq', 'pm', 'dots', 'ldots', 'pi', 'angle', 'overline', 'underline', 'text', 'textbf',
  'mathrm', 'mathbf', 'begin', 'end', 'parallel', 'perp', 'circ', 'left', 'right',
  'approx', 'infty', 'in', 'notin', 'cup', 'cap', 'to', 'Rightarrow', 'square',
].join('|');

const FRACTION_COMMANDS = new Set(['frac', 'dfrac', 'tfrac']);
const ONE_ARGUMENT_COMMANDS = new Set([
  'overline', 'underline', 'text', 'textbf', 'mathrm', 'mathbf', 'begin', 'end',
]);
const SYMBOL_COMMANDS = new Set([
  'times', 'div', 'cdot', 'le', 'leq', 'ge', 'geq', 'neq', 'pm', 'dots', 'ldots', 'pi', 'angle',
  'parallel', 'perp', 'circ', 'left', 'right', 'approx', 'infty', 'in', 'notin', 'cup', 'cap',
  'to', 'Rightarrow', 'square',
]);
const SUPPORTED_COMMANDS = new Set(KNOWN_COMMANDS.split('|'));

interface BalancedGroup {
  content: string;
  end: number;
}

const isEscaped = (value: string, index: number): boolean => {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) slashCount++;
  return slashCount % 2 === 1;
};

const skipWhitespace = (value: string, start: number): number => {
  let cursor = start;
  while (cursor < value.length && /\s/.test(value[cursor])) cursor++;
  return cursor;
};

const readBalancedGroup = (
  value: string,
  start: number,
  open = '{',
  close = '}',
): BalancedGroup | null => {
  if (value[start] !== open) return null;
  let depth = 0;
  for (let i = start; i < value.length; i++) {
    if (isEscaped(value, i)) continue;
    if (value[i] === open) depth++;
    if (value[i] === close) {
      depth--;
      if (depth === 0) {
        return { content: value.slice(start + 1, i), end: i + 1 };
      }
    }
  }
  return null;
};

const getCommandAt = (value: string, start: number): { name: string; end: number } | null => {
  if (value[start] !== '\\' || isEscaped(value, start)) return null;
  const match = value.slice(start).match(/^\\([A-Za-z]+)/);
  if (!match) return null;
  return { name: match[1], end: start + match[0].length };
};

/** Return the end of a complete supported raw TeX command, including balanced arguments. */
const readRawCommandEnd = (value: string, start: number): number | null => {
  const command = getCommandAt(value, start);
  if (!command) return null;

  let cursor = skipWhitespace(value, command.end);

  if (FRACTION_COMMANDS.has(command.name)) {
    const numerator = readBalancedGroup(value, cursor);
    if (!numerator) return null;
    cursor = skipWhitespace(value, numerator.end);
    const denominator = readBalancedGroup(value, cursor);
    return denominator?.end ?? null;
  }

  if (command.name === 'sqrt') {
    if (value[cursor] === '[') {
      const degree = readBalancedGroup(value, cursor, '[', ']');
      if (!degree) return null;
      cursor = skipWhitespace(value, degree.end);
    }
    return readBalancedGroup(value, cursor)?.end ?? null;
  }

  if (ONE_ARGUMENT_COMMANDS.has(command.name)) {
    return readBalancedGroup(value, cursor)?.end ?? null;
  }

  if (SYMBOL_COMMANDS.has(command.name)) return command.end;
  return null;
};

const findClosingDollar = (value: string, start: number, display: boolean): number => {
  const marker = display ? '$$' : '$';
  for (let i = start; i < value.length; i++) {
    if (value.startsWith(marker, i) && !isEscaped(value, i)) {
      if (!display && (value[i - 1] === '$' || value[i + 1] === '$')) continue;
      return i;
    }
  }
  return -1;
};

export const splitMathSegments = (input: string): MathTextSegment[] => {
  const value = String(input ?? '');
  const segments: MathTextSegment[] = [];
  let textStart = 0;
  let i = 0;

  const pushText = (end: number) => {
    if (end > textStart) {
      const raw = value.slice(textStart, end);
      segments.push({ type: 'text', raw, inner: raw, start: textStart, end });
    }
  };

  while (i < value.length) {
    let delimiter: MathDelimiter | undefined;
    let close = '';
    let openLength = 0;
    let display = false;

    if (value.startsWith('$$', i) && !isEscaped(value, i)) {
      delimiter = '$$'; close = '$$'; openLength = 2; display = true;
    } else if (value[i] === '$' && !isEscaped(value, i)) {
      delimiter = '$'; close = '$'; openLength = 1;
    } else if (value.startsWith('\\(', i)) {
      delimiter = '\\('; close = '\\)'; openLength = 2;
    } else if (value.startsWith('\\[', i)) {
      delimiter = '\\['; close = '\\]'; openLength = 2; display = true;
    }

    if (!delimiter) {
      i++;
      continue;
    }

    const closeIndex = delimiter === '$' || delimiter === '$$'
      ? findClosingDollar(value, i + openLength, delimiter === '$$')
      : value.indexOf(close, i + openLength);

    if (closeIndex === -1) {
      i += openLength;
      continue;
    }

    pushText(i);
    const end = closeIndex + close.length;
    const raw = value.slice(i, end);
    segments.push({
      type: 'math',
      raw,
      inner: value.slice(i + openLength, closeIndex),
      start: i,
      end,
      delimiter,
      display,
    });
    i = end;
    textStart = end;
  }

  pushText(value.length);
  return segments;
};

const normalizeEscapedCommands = (input: string): string => {
  const commandPattern = new RegExp(String.raw`\\\\(?=(?:${KNOWN_COMMANDS})\b)`, 'g');
  let result = input;
  for (let i = 0; i < 3; i++) {
    const next = result.replace(commandPattern, '\\');
    if (next === result) break;
    result = next;
  }
  return result;
};

const repairDollarMismatches = (input: string): string => input
  .replace(/(?<!\$)\$([^$\n]+)\$\$(?!\$)/g, (_match, inner: string) => `$${inner}$`)
  .replace(/(?<!\$)\$\$([^$\n]+)\$(?!\$)/g, (_match, inner: string) => `$${inner}$`);

const wrapRawCommandsWithoutDelimiters = (value: string): string => {
  let output = '';
  let cursor = 0;
  let i = 0;
  while (i < value.length) {
    if (value[i] === '\\') {
      const commandEnd = readRawCommandEnd(value, i);
      if (commandEnd !== null) {
        output += value.slice(cursor, i);
        output += `$${value.slice(i, commandEnd)}$`;
        cursor = commandEnd;
        i = commandEnd;
        continue;
      }
    }
    i++;
  }
  output += value.slice(cursor);
  return output;
};

const countUnescapedDollars = (value: string): number => {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '$' && !isEscaped(value, i)) count++;
  }
  return count;
};

/** Repair only known legacy forms such as "\\frac{1}{2}$" and "= 1$". */
const repairLegacyClosingDollars = (value: string): string => {
  let output = '';
  let cursor = 0;
  let i = 0;

  while (i < value.length) {
    if (value[i] === '\\') {
      const commandEnd = readRawCommandEnd(value, i);
      const hasSingleClosingDollar = commandEnd !== null
        && value[commandEnd] === '$'
        && value[commandEnd + 1] !== '$';
      if (commandEnd !== null && hasSingleClosingDollar) {
        output += value.slice(cursor, i);
        output += `$${value.slice(i, commandEnd)}$`;
        cursor = commandEnd + 1;
        i = commandEnd + 1;
        continue;
      }
    }
    i++;
  }
  output += value.slice(cursor);

  if (countUnescapedDollars(output) % 2 === 1) {
    const lastDollar = output.lastIndexOf('$');
    if (lastDollar >= 0 && /^[\s.!?,;:]*$/.test(output.slice(lastDollar + 1))) {
      output = output.slice(0, lastDollar) + output.slice(lastDollar + 1);
    }
  }
  return output;
};

const wrapBalancedRawTex = (segment: string): string => {
  if (!segment) return segment;

  let normalized = segment
    .replace(/(?<!\\)\bfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '\\frac{$1}{$2}')
    .replace(/(?<!\\)\bfrac(\d)(\d+)\b/g, '\\frac{$1}{$2}');

  normalized = repairLegacyClosingDollars(normalized);
  const reparsed = splitMathSegments(normalized);
  if (reparsed.some((part) => part.type === 'math')) {
    return reparsed
      .map((part) => part.type === 'math' ? part.raw : wrapRawCommandsWithoutDelimiters(part.raw))
      .join('');
  }

  // Do not guess around a still-unclosed delimiter; validation will report it.
  if (normalized.includes('$') || normalized.includes('\\(') || normalized.includes('\\[')) {
    return normalized;
  }
  return wrapRawCommandsWithoutDelimiters(normalized);
};

export const normalizeMathText = (input: unknown): string => {
  if (input === null || input === undefined) return '';
  const original = typeof input === 'string' ? input : String(input);
  if (!original) return '';

  const lineNormalized = original.replace(/\r\n?/g, '\n').replace(/\\n/g, '\n');
  const slashNormalized = normalizeEscapedCommands(lineNormalized);
  const repaired = repairDollarMismatches(slashNormalized);
  const segments = splitMathSegments(repaired);

  if (segments.length === 0) return wrapBalancedRawTex(repaired);

  return segments
    .map((segment) => segment.type === 'math' ? segment.raw : wrapBalancedRawTex(segment.raw))
    .join('');
};

export const hasMathSyntax = (input: unknown): boolean => {
  if (input === null || input === undefined) return false;
  const value = String(input);
  return /\$|\\\(|\\\[|\\(?:frac|dfrac|tfrac|sqrt|times|div|cdot|leq?|geq?|neq|pm|dots|ldots|pi|angle|begin|end)\b|\bfrac(?:\d|\s*\{)/.test(value);
};

const analyzeBraces = (value: string, offset: number): MathSyntaxIssue[] => {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (isEscaped(value, i)) continue;
    if (value[i] === '{') depth++;
    if (value[i] === '}') {
      depth--;
      if (depth < 0) {
        return [{
          code: 'unbalanced-braces',
          message: 'Có dấu } không có dấu { tương ứng.',
          index: offset + i,
        }];
      }
    }
  }
  return depth === 0 ? [] : [{
    code: 'unbalanced-braces',
    message: `Thiếu ${depth} dấu } trong công thức.`,
    index: offset + value.length,
  }];
};

const findMalformedCommands = (value: string, offset = 0): MathSyntaxIssue[] => {
  const issues: MathSyntaxIssue[] = [];
  for (let i = 0; i < value.length; i++) {
    const command = getCommandAt(value, i);
    if (!command) continue;
    if (!SUPPORTED_COMMANDS.has(command.name)) {
      issues.push({
        code: 'unsupported-command',
        message: `\\${command.name} chưa được hỗ trợ.`,
        index: offset + i,
      });
      i = Math.max(i, command.end - 1);
      continue;
    }
    const requiresArguments = FRACTION_COMMANDS.has(command.name)
      || command.name === 'sqrt'
      || ONE_ARGUMENT_COMMANDS.has(command.name);
    if (requiresArguments && readRawCommandEnd(value, i) === null) {
      issues.push({
        code: 'malformed-command',
        message: `\\${command.name} chưa có đủ đối số hợp lệ trong dấu ngoặc.`,
        index: offset + i,
      });
    }
    i = Math.max(i, command.end - 1);
  }
  return issues;
};

export const analyzeMathText = (input: unknown): MathSyntaxIssue[] => {
  if (input === null || input === undefined) return [];
  const value = normalizeEscapedCommands(String(input));
  if (!hasMathSyntax(value)) return [];

  const issues: MathSyntaxIssue[] = [];
  let i = 0;
  while (i < value.length) {
    let open = '';
    let close = '';
    let display = false;

    if (value.startsWith('$$', i) && !isEscaped(value, i)) {
      open = '$$'; close = '$$'; display = true;
    } else if (value[i] === '$' && !isEscaped(value, i)) {
      open = '$'; close = '$';
    } else if (value.startsWith('\\(', i)) {
      open = '\\('; close = '\\)';
    } else if (value.startsWith('\\[', i)) {
      open = '\\['; close = '\\]';
    } else if (value.startsWith('\\)', i) || value.startsWith('\\]', i)) {
      issues.push({
        code: 'unexpected-delimiter',
        message: `Dấu đóng ${value.slice(i, i + 2)} không có dấu mở tương ứng.`,
        index: i,
      });
      i += 2;
      continue;
    } else {
      i++;
      continue;
    }

    const contentStart = i + open.length;
    const closeIndex = open === '$' || open === '$$'
      ? findClosingDollar(value, contentStart, display)
      : value.indexOf(close, contentStart);

    if (closeIndex === -1) {
      issues.push({
        code: 'unclosed-delimiter',
        message: `Công thức mở bằng ${open} nhưng chưa có dấu đóng ${close}.`,
        index: i,
      });
      issues.push(...analyzeBraces(value.slice(contentStart), contentStart));
      break;
    }

    const inner = value.slice(contentStart, closeIndex);
    issues.push(...analyzeBraces(inner, contentStart));
    issues.push(...findMalformedCommands(inner, contentStart));
    i = closeIndex + close.length;
  }

  // Raw TeX outside complete delimiters must be checked as well.
  for (const segment of splitMathSegments(value)) {
    if (segment.type !== 'text' || !hasMathSyntax(segment.raw)) continue;
    issues.push(...analyzeBraces(segment.raw, segment.start));
    issues.push(...findMalformedCommands(segment.raw, segment.start));
  }

  return issues.filter((issue, index, all) =>
    all.findIndex((candidate) => candidate.code === issue.code && candidate.index === issue.index) === index,
  );
};