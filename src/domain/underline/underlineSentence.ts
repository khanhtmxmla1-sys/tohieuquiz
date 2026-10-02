import { normalizeMathText, splitMathSegments } from '../../utils/mathText';

export type UnderlineSegment =
  | {
      kind: 'whitespace';
      text: string;
    }
  | {
      kind: 'token';
      text: string;
      index: number;
      prefix: string;
      core: string;
      suffix: string;
    };

type Grapheme = { segment: string };
type GraphemeSegmenter = {
  segment: (text: string) => Iterable<Grapheme>;
};
type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' },
) => GraphemeSegmenter;

const IntlWithSegmenter = Intl as typeof Intl & {
  Segmenter?: GraphemeSegmenterConstructor;
};

const graphemeSegmenter = IntlWithSegmenter.Segmenter
  ? new IntlWithSegmenter.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;

const lexicalCharacter = /[\p{L}\p{N}]/u;

function splitIntoGraphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
  }

  const graphemes: string[] = [];
  for (const character of Array.from(text)) {
    const previous = graphemes.at(-1);
    if (
      previous &&
      (/^[\p{M}]$/u.test(character) || character === '\u200d' || previous.endsWith('\u200d'))
    ) {
      graphemes[graphemes.length - 1] += character;
    } else {
      graphemes.push(character);
    }
  }
  return graphemes;
}

function isNonLexicalGrapheme(grapheme: string): boolean {
  return !lexicalCharacter.test(grapheme);
}

const mathCoreRange = (text: string): { start: number; end: number } | undefined => {
  const ranges: Array<{ start: number; end: number }> = [];
  const directMathSegments = splitMathSegments(text).filter((segment) => segment.type === 'math');
  if (directMathSegments.length > 0) {
    ranges.push({
      start: directMathSegments[0].start,
      end: directMathSegments[directMathSegments.length - 1].end,
    });
  }

  // normalizeMathText wraps supported raw commands (for example, \\frac{1}{2})
  // for MathSpan. Locate the original command text so its backslash/braces stay
  // in the clickable core while adjacent punctuation remains plain.
  const normalizedMathSegments = splitMathSegments(normalizeMathText(text))
    .filter((segment) => segment.type === 'math');
  for (const segment of normalizedMathSegments) {
    const start = text.indexOf(segment.inner);
    if (start >= 0) ranges.push({ start, end: start + segment.inner.length });
  }

  if (ranges.length === 0) return undefined;
  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end)),
  };
};

/**
 * Splits a visible token into punctuation that should stay plain text and the
 * lexical core that can be selected/underlined.
 */
export function splitUnderlineToken(text: string): {
  prefix: string;
  core: string;
  suffix: string;
} {
  const characters = splitIntoGraphemes(text);
  let start = 0;
  let end = characters.length;

  while (start < end && isNonLexicalGrapheme(characters[start])) {
    start += 1;
  }

  while (end > start && isNonLexicalGrapheme(characters[end - 1])) {
    end -= 1;
  }

  // TeX delimiters are syntax, not sentence punctuation. Expand the lexical
  // core to include a complete math segment so MathSpan receives `$x$` (or
  // `\\(...\\)`) intact while commas and quotes remain plain siblings.
  const mathRange = mathCoreRange(text);
  if (mathRange) {
    const hasLexicalCore = start < end;
    const genericStart = hasLexicalCore ? characters.slice(0, start).join('').length : mathRange.start;
    const genericEnd = hasLexicalCore
      ? text.length - characters.slice(end).join('').length
      : mathRange.end;
    const coreStart = Math.min(genericStart, mathRange.start);
    const coreEnd = Math.max(genericEnd, mathRange.end);
    return {
      prefix: text.slice(0, coreStart),
      core: text.slice(coreStart, coreEnd),
      suffix: text.slice(coreEnd),
    };
  }

  if (start === end) {
    return { prefix: text, core: '', suffix: '' };
  }

  return {
    prefix: characters.slice(0, start).join(''),
    core: characters.slice(start, end).join(''),
    suffix: characters.slice(end).join(''),
  };
}

function createTokenSegment(text: string, index: number): UnderlineSegment {
  const { prefix, core, suffix } = splitUnderlineToken(text);
  return { kind: 'token', text, index, prefix, core, suffix };
}

function fallbackSegments(words: string[]): UnderlineSegment[] {
  return words.flatMap((word, index) => [
    ...(index > 0 ? [{ kind: 'whitespace' as const, text: ' ' }] : []),
    createTokenSegment(word, index),
  ]);
}

function matchesWord(candidate: string, word: string): boolean {
  if (candidate.normalize('NFC') === word.normalize('NFC')) return true;

  // Sentence punctuation is presentation-only, so allow a source sentence to
  // omit punctuation from its words while retaining the sentence text.
  const candidateCore = splitUnderlineToken(candidate).core;
  const wordCore = splitUnderlineToken(word).core;
  return (
    candidateCore.length > 0 &&
    candidateCore.normalize('NFC') === wordCore.normalize('NFC')
  );
}

export function buildUnderlineSegments(
  sentence: string | undefined,
  words: string[],
): UnderlineSegment[] {
  const normalizedWords = Array.isArray(words) ? words.map(String) : [];
  const chunks = sentence?.match(/\s+|\S+/gu) ?? [];
  const visibleChunks = chunks.filter((chunk) => !/^\s+$/u.test(chunk));

  const isInSync =
    visibleChunks.length === normalizedWords.length &&
    visibleChunks.every((chunk, index) => matchesWord(chunk, normalizedWords[index]));

  if (!isInSync) {
    return fallbackSegments(normalizedWords);
  }

  let tokenIndex = 0;
  return chunks.map((chunk): UnderlineSegment => {
    if (/^\s+$/u.test(chunk)) {
      return { kind: 'whitespace', text: chunk };
    }

    const segment = createTokenSegment(chunk, tokenIndex);
    tokenIndex += 1;
    return segment;
  });
}
