import {
  normalizeQuestionForGrading,
  type QuizAnswer,
} from '../../../src/domain/quiz-scoring';
import { getBlankId } from '../../../src/domain/quiz-scoring/questionIdentity';
import { richTextToPlainText } from '../../../shared/question-rich-text.contract';
import {
  toStudentQuestionDto,
  type StudentQuizQuestionDto,
  type StudentQuizQuestionDtoContext,
} from './studentQuizQuestionDto';

/**
 * Practice has one extra presentation boundary on top of the shared learner
 * DTO.  The shared DTO is intentionally unchanged because formal and live
 * quizzes have existing compatibility requirements.  Practice must also
 * avoid exposing the authored order of ORDERING/WORD_SCRAMBLE items and must
 * neutralize answer-bearing blank markers before the browser sees them.
 */
export class PracticePresentationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'PracticePresentationError';
  }
}

type RecordValue = Record<string, any>;

const asRecord = (value: unknown): RecordValue => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : {}
);

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => String(value ?? '');

const textEncoder = new TextEncoder();

const keyBytes = (key: string | Uint8Array): Uint8Array => (
  typeof key === 'string' ? textEncoder.encode(key) : key
);

const hmacHex = async (key: string | Uint8Array, message: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(message));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const isLatexOptionalBracket = (input: string, index: number): boolean => {
  if (index > 0 && input[index - 1] === '\\') return true;
  const prefix = input.slice(Math.max(0, index - 20), index);
  return /\\sqrt\s*$/.test(prefix);
};

const isEscapedUnderscoreMarker = (input: string, index: number): boolean => (
  index > 0 && input[index - 1] === '\\'
);

interface PracticeBlankMarker {
  start: number;
  end: number;
}

/**
 * Find only interactive blank markers. A regex that starts at an escaped `\[`
 * can consume a later real `[answer]` marker, so scan delimiters without
 * swallowing nested/escaped math text.
 */
const findPracticeBlankMarkers = (text: string): PracticeBlankMarker[] => {
  const markers: PracticeBlankMarker[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] === '_') {
      let end = index;
      while (text[end] === '_') end += 1;
      if (end - index >= 3 && !isEscapedUnderscoreMarker(text, index)) {
        markers.push({ start: index, end });
      }
      index = end;
      continue;
    }
    if (text[index] !== '[' || (index > 0 && text[index - 1] === '\\')
      || isLatexOptionalBracket(text, index)) {
      index += 1;
      continue;
    }
    const end = text.indexOf(']', index + 1);
    if (end < 0) {
      index += 1;
      continue;
    }
    markers.push({ start: index, end: end + 1 });
    index = end + 1;
  }
  return markers;
};

/** The interactive renderer safely discovers blanks inside `$$...$$` math. */
const normalizeDisplayMathWithBlanks = (text: string): string => text.replace(
  /\\\[([\s\S]*?)\\\]/g,
  (full, inner: string) => findPracticeBlankMarkers(inner).length > 0 ? `$$${inner}$$` : full,
);

/**
 * Replace only non-LaTeX bracket tokens that belong to this question's blank
 * contract.  If the number of tokens does not match the number of blanks we
 * fail closed instead of guessing whether a visible token is an answer.
 * Underscore placeholders are rewritten as the same neutral bracket markers
 * used by the interactive renderer. Escaped underscores remain literal text.
 */
export function normalizePracticeBlankText(textInput: unknown, blankCount: number, requireMarkers = true): string {
  const text = asString(textInput);
  if (blankCount === 0) return text;
  const markers = findPracticeBlankMarkers(text);
  const tokenCount = markers.length;
  if (tokenCount === 0 && !requireMarkers) return text;
  if (tokenCount !== blankCount) {
    throw new PracticePresentationError(
      'PRACTICE_BLANK_MARKERS_INVALID',
      'Practice question blank markers do not match its blank contract.',
    );
  }
  let ordinal = 0;
  let cursor = 0;
  let normalized = '';
  for (const marker of markers) {
    normalized += text.slice(cursor, marker.start);
    ordinal += 1;
    normalized += `[${ordinal}]`;
    cursor = marker.end;
  }
  return normalizeDisplayMathWithBlanks(normalized + text.slice(cursor));
}

const stableSort = async (
  values: number[],
  context: StudentQuizQuestionDtoContext,
  questionId: string,
  purpose: string,
): Promise<number[]> => {
  const keyed = await Promise.all(values.map(async (value) => ({
    value,
    key: await hmacHex(
      context.key,
      ['tohieuquiz-practice-presentation-v1', context.scope, context.quizId, context.revision, questionId, purpose, value].join('|'),
    ),
  })));
  keyed.sort((left, right) => left.key.localeCompare(right.key) || left.value - right.value);
  return keyed.map((item) => item.value);
};

/** Mapping from presented array position to the canonical authored position. */
export async function practicePresentationPermutation(
  questionInput: unknown,
  context: StudentQuizQuestionDtoContext,
  purpose: 'ordering' | 'word-scramble',
): Promise<number[]> {
  const question = asRecord(questionInput);
  const source = purpose === 'ordering'
    ? asArray(question.items)
    : asArray(question.letters ?? question.items);
  return stableSort(
    source.map((_value, index) => index),
    context,
    asString(question.id),
    purpose,
  );
}

const reorder = <T,>(values: readonly T[], permutation: readonly number[]): T[] => (
  permutation.map((canonicalIndex) => values[canonicalIndex]).filter((value): value is T => value !== undefined)
);

const reorderDropdownOptions = async (
  values: readonly string[],
  context: StudentQuizQuestionDtoContext,
  questionId: string,
  blankIndex: number,
): Promise<string[]> => {
  const keyed = await Promise.all(values.map(async (value, index) => ({
    value,
    index,
    key: await hmacHex(
      context.key,
      ['tohieuquiz-practice-presentation-v1', context.scope, context.quizId, context.revision, questionId, 'dropdown-option', blankIndex, index].join('|'),
    ),
  })));
  keyed.sort((left, right) => left.key.localeCompare(right.key) || left.index - right.index);
  return keyed.map((item) => item.value);
};

const questionType = (question: RecordValue): string => asString(question.type ?? question.questionType).trim().toUpperCase();

const dropdownBlankOpaqueId = async (
  questionId: string,
  index: number,
  context: StudentQuizQuestionDtoContext,
): Promise<string> => `sq1_${(await hmacHex(
  context.key,
  ['tohieuquiz-practice-presentation-v1', context.scope, context.quizId, context.revision, questionId, 'dropdown-blank', index].join('|'),
)).slice(0, 32)}`;

const normalizeTrueFalseItems = (question: RecordValue): RecordValue => {
  if (questionType(question) !== 'TRUE_FALSE' || !Array.isArray(question.items)) return question;
  return {
    ...question,
    items: question.items.map((item, index) => {
      const record = asRecord(item);
      return record.id ? item : { ...record, id: `item-${index}` };
    }),
  };
};

const normalizeSafeFields = (
  dto: StudentQuizQuestionDto,
  question: RecordValue,
): StudentQuizQuestionDto => {
  const type = questionType(question);
  if (type === 'IMAGE_QUESTION') {
    // The shared text-list projection filters empty values, which shifts a
    // sparse image-option array. Practice must preserve both option positions.
    const rawOptions = question.options;
    if (Array.isArray(rawOptions)) dto.options = rawOptions.map(asString);
    else if (typeof rawOptions === 'string') dto.options = rawOptions.split('|').map(asString);
    const raw = question.optionImages ?? question.distractors;
    if (Array.isArray(raw)) dto.optionImages = raw.map(asString);
    else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) dto.optionImages = parsed.map(asString);
      } catch {
        // An invalid optional image list is safe to omit; the question itself
        // remains renderable through its text options.
      }
    }
  }
  return dto;
};

/**
 * Build a practice DTO from a mapped authoring row.  Normalization is done
 * before the answer-bearing fields are projected so malformed questions never
 * become an apparently playable but ungradable public quiz.
 */
export async function toPracticeQuestionDto(
  questionInput: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<StudentQuizQuestionDto> {
  const question = normalizeTrueFalseItems(asRecord(questionInput));
  const normalized = normalizeQuestionForGrading(question);
  if (!normalized.ok) {
    throw new PracticePresentationError(
      normalized.issues[0]?.code ?? 'PRACTICE_QUESTION_INVALID',
      normalized.issues[0]?.message ?? 'Practice question is not gradable.',
    );
  }

  const dto = normalizeSafeFields(await toStudentQuestionDto(question, context), question);
  const type = questionType(question);
  const id = asString(question.id);

  if (type === 'DRAG_DROP' || type === 'DROPDOWN') {
    const blankCount = asArray(question.blanks).length;
    if (dto.text !== undefined) dto.text = normalizePracticeBlankText(dto.text, blankCount, true);
    if (dto.question !== undefined) dto.question = normalizePracticeBlankText(dto.question, blankCount, false);
    if (dto.mainQuestion !== undefined) dto.mainQuestion = normalizePracticeBlankText(dto.mainQuestion, blankCount, false);

    if (type === 'DROPDOWN' && Array.isArray(dto.blanks)) {
      dto.blanks = await Promise.all(dto.blanks.map(async (blank, index) => {
        const record = asRecord(blank);
        const options = Array.isArray(record.options)
          ? await reorderDropdownOptions(record.options.map(asString), context, id, index)
          : [];
        return {
          ...record,
          id: await dropdownBlankOpaqueId(id, index, context),
          options,
        };
      }));
    }

    // Rich text nodes can split a marker across formatting boundaries. The
    // shared DTO intentionally preserves rich text for formal/live clients;
    // practice drops only the unsafe rich projection and retains a normalized
    // plain-text fallback so no answer-bearing rich duplicate reaches a guest.
    if (dto.questionRichText && (type === 'DRAG_DROP' || type === 'DROPDOWN')) {
      const richPlain = richTextToPlainText(dto.questionRichText as any);
      const hasBracketMarker = findPracticeBlankMarkers(richPlain).length > 0;
      if (hasBracketMarker) {
        const normalizedRichPlain = normalizePracticeBlankText(richPlain, blankCount, true);
        delete dto.questionRichText;
        dto.question = normalizedRichPlain;
      }
    }
  }

  if (type === 'TRUE_FALSE') {
    const sourceItems = asArray(question.items);
    const dtoItems = asArray(dto.items);
    if (sourceItems.length === 0 || dtoItems.length !== sourceItems.length) {
      throw new PracticePresentationError(
        'PRACTICE_TRUE_FALSE_ITEMS_INVALID',
        'True/false items must have a complete safe presentation.',
      );
    }
  }

  if (type === 'ORDERING') {
    const permutation = await practicePresentationPermutation(question, context, 'ordering');
    dto.items = reorder(asArray(dto.items), permutation);
  }

  if (type === 'WORD_SCRAMBLE') {
    const permutation = await practicePresentationPermutation(question, context, 'word-scramble');
    dto.letters = reorder(asArray(dto.letters), permutation);
  }

  // Keep this explicit: a future field added to the shared DTO must not be
  // silently promoted into the public practice contract.
  delete dto.correctAnswer;
  delete dto.correctAnswers;
  delete dto.correctOrder;
  delete dto.correctWordIndexes;
  delete dto.correctWord;
  delete dto.wrongWord;
  delete dto.correct_answer;
  delete dto.correct_word_indexes;
  delete dto.correct_word;
  delete dto.explanation;
  return dto;
}

const unwrapAnswer = (value: unknown): unknown => {
  const record = asRecord(value);
  return Object.prototype.hasOwnProperty.call(record, 'selectedAnswer')
    ? record.selectedAnswer
    : value;
};

const opaqueId = (value: unknown): boolean => typeof value === 'string' && value.startsWith('sq1_');

/**
 * Validate answer IDs before the compatibility decoder. The decoder accepts
 * legacy canonical IDs for old live/formal submissions; secure practice does
 * not, because every structured ID must come from this session's DTO.
 */
export async function validatePracticeStructuredAnswer(
  questionInput: unknown,
  rawAnswer: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<void> {
  const question = asRecord(questionInput);
  const answer = unwrapAnswer(rawAnswer);
  const type = questionType(question);
  if (answer === undefined || answer === null || answer === '') return;
  if (Array.isArray(answer) || typeof answer !== 'object') {
    if (['MATCHING', 'DRAG_DROP', 'DROPDOWN'].includes(type)) {
      throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Structured practice answers must be objects.');
    }
    return;
  }

  const dto = await toPracticeQuestionDto(question, context);
  const record = asRecord(answer);

  if (type === 'MATCHING') {
    if (record.pairs !== undefined && (typeof record.pairs !== 'object' || Array.isArray(record.pairs))) {
      throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Matching pairs must be an object.');
    }
    const pairs = asRecord(record.pairs ?? record);
    for (const [left, right] of Object.entries(pairs)) {
      if (['type', 'selectedLeft', '__shuffledIds'].includes(left)) continue;
      if (!opaqueId(left) || !opaqueId(right)) {
        throw new PracticePresentationError('PRACTICE_STRUCTURED_ID_INVALID', 'Matching answer IDs are not valid for this practice session.');
      }
    }
    const leftIds = new Set(asArray(dto.leftItems).map((item) => asString(asRecord(item).id)));
    const rightIds = new Set(asArray(dto.rightItems).map((item) => asString(asRecord(item).id)));
    for (const [left, right] of Object.entries(pairs)) {
      if (['type', 'selectedLeft', '__shuffledIds'].includes(left)) continue;
      if (!leftIds.has(left) || !rightIds.has(asString(right))) {
        throw new PracticePresentationError('PRACTICE_STRUCTURED_ID_INVALID', 'Matching answer ID is outside this practice session.');
      }
    }
  }

  if (type === 'DRAG_DROP') {
    if (record.values !== undefined && (typeof record.values !== 'object' || Array.isArray(record.values))) {
      throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Drag/drop values must be an object.');
    }
    const values = asRecord(record.values ?? record);
    const blankIds = new Set(asArray(dto.blanks).map((blank) => asString(asRecord(blank).id)));
    for (const [blankId, value] of Object.entries(values)) {
      if (blankId === 'type') continue;
      if (!opaqueId(blankId) || !blankIds.has(blankId) || typeof value !== 'string') {
        throw new PracticePresentationError('PRACTICE_STRUCTURED_ID_INVALID', 'Drag/drop answer IDs are not valid for this practice session.');
      }
    }
  }

  if (type === 'DROPDOWN') {
    if (record.values !== undefined && (typeof record.values !== 'object' || Array.isArray(record.values))) {
      throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Dropdown values must be an object.');
    }
    const values = asRecord(record.values ?? record);
    const blankIds = new Set(asArray(dto.blanks).map((blank) => asString(asRecord(blank).id)));
    for (const [blankId, value] of Object.entries(values)) {
      if (blankId === 'type') continue;
      if (!blankIds.has(blankId) || typeof value !== 'string') {
        throw new PracticePresentationError('PRACTICE_STRUCTURED_ID_INVALID', 'Dropdown answer IDs are not valid for this practice session.');
      }
    }
  }
}

export async function rebasePracticeAnswerForGrading(
  questionInput: unknown,
  rawAnswer: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<unknown> {
  const question = asRecord(questionInput);
  const answer = unwrapAnswer(rawAnswer);
  const type = questionType(question);
  if (type === 'ORDERING' && Array.isArray(answer)) {
    const permutation = await practicePresentationPermutation(question, context, 'ordering');
    const canonicalOrder = answer.map((value) => {
      if (!Number.isSafeInteger(value)) {
        throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer index is invalid.');
      }
      const canonicalIndex = permutation[value];
      if (!Number.isInteger(canonicalIndex)) {
        throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer index is outside this practice session.');
      }
      return canonicalIndex;
    });
    return { type: 'ORDERING', ranks: canonicalOrder };
  }
  if (type === 'WORD_SCRAMBLE' && Array.isArray(answer)) {
    const permutation = await practicePresentationPermutation(question, context, 'word-scramble');
    return {
      type: 'WORD_SCRAMBLE',
      letterIndexes: answer.map((value) => {
        if (!Number.isSafeInteger(value)) {
          throw new PracticePresentationError('PRACTICE_LETTER_ID_INVALID', 'Word-scramble answer index is invalid.');
        }
        const canonicalIndex = permutation[value];
        if (!Number.isInteger(canonicalIndex)) {
          throw new PracticePresentationError('PRACTICE_LETTER_ID_INVALID', 'Word-scramble answer index is outside this practice session.');
        }
        return canonicalIndex;
      }),
    } satisfies QuizAnswer;
  }
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    if (['MATCHING', 'DRAG_DROP', 'DROPDOWN'].includes(type) && answer !== undefined && answer !== null && answer !== '') {
      throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Structured practice answers must be objects.');
    }
    return answer;
  }
  const record = asRecord(answer);

  if (type === 'ORDERING') {
    const permutation = await practicePresentationPermutation(question, context, 'ordering');
    if (Array.isArray(record.ranks)) {
      const canonicalOrder = record.ranks.map((value) => {
        if (!Number.isSafeInteger(value)) {
          throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer index is invalid.');
        }
        const canonicalIndex = permutation[value];
        if (!Number.isInteger(canonicalIndex)) {
          throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer index is outside this practice session.');
        }
        return canonicalIndex;
      });
      return { type: 'ORDERING', ranks: canonicalOrder };
    }
    const source = asRecord(record.ranks ?? record);
    const ranks: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (['type', 'selectedLeft', '__shuffledIds'].includes(key)) continue;
      const match = key.match(/^item-(\d+)$/i);
      if (!match) {
        throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer ID is invalid.');
      }
      const presentedIndex = Number(match[1]);
      const canonicalIndex = permutation[presentedIndex];
      if (canonicalIndex === undefined) {
        throw new PracticePresentationError('PRACTICE_ORDERING_ID_INVALID', 'Ordering answer ID is outside this practice session.');
      }
      ranks[`item-${canonicalIndex}`] = value;
    }
    return { type: 'ORDERING', ranks };
  }

  if (type === 'WORD_SCRAMBLE') {
    const permutation = await practicePresentationPermutation(question, context, 'word-scramble');
    const source = Array.isArray(record.letterIndexes) ? record.letterIndexes : answer;
    if (!Array.isArray(source)) return answer;
    return {
      type: 'WORD_SCRAMBLE',
      letterIndexes: source.map((value) => {
        const presentedIndex = Number(value);
        const canonicalIndex = permutation[presentedIndex];
        if (!Number.isInteger(canonicalIndex)) {
          throw new PracticePresentationError('PRACTICE_LETTER_ID_INVALID', 'Word-scramble answer index is invalid.');
        }
        return canonicalIndex;
      }),
    } satisfies QuizAnswer;
  }

  if (type === 'DROPDOWN') {
    const source = asRecord(record.values ?? record);
    const values: Record<string, string> = {};
    const blankCount = asArray(question.blanks).length;
    const blankIds = await Promise.all(Array.from({ length: blankCount }, (_value, index) => (
      dropdownBlankOpaqueId(asString(question.id), index, context)
    )));
    const opaqueToCanonical = new Map(blankIds.map((opaque, index) => [opaque, getBlankId(question, index)]));
    for (const [key, value] of Object.entries(source)) {
      if (key === 'type') continue;
      const canonical = opaqueToCanonical.get(key);
      if (!canonical) throw new PracticePresentationError('PRACTICE_STRUCTURED_ID_INVALID', 'Dropdown answer ID is outside this practice session.');
      if (typeof value !== 'string') throw new PracticePresentationError('PRACTICE_STRUCTURED_ANSWER_INVALID', 'Dropdown answer values must be strings.');
      values[canonical] = value;
    }
    return { type: 'DROPDOWN', values } satisfies QuizAnswer;
  }

  return answer;
}
