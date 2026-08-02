import { asArray, asRecord, normalizeText, parseMaybeJson } from './questionIdentity';
import { withoutUiMetadata, unwrapStoredResultAnswer } from './legacyAnswerAdapters';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import type { NormalizedAnswerResult, NormalizedGradableQuestion, NormalizedOption, QuizAnswer } from './types';

const fail = (issueCode: string, message: string): NormalizedAnswerResult => ({ ok: false, issueCode, message });

const optionIdFor = (raw: unknown, options: readonly NormalizedOption[]): string | null => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (record.optionId !== undefined) return optionIdFor(record.optionId, options);
    if (record.value !== undefined) return optionIdFor(record.value, options);
  }
  if (typeof raw === 'number' && Number.isInteger(raw)) return options[raw]?.id ?? null;
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const idMatch = value.match(/^option-(\d+)$/i);
  if (idMatch) return options[Number(idMatch[1])]?.id ?? null;

  const contentMatches = options.filter((option) => normalizeText(option.text) === normalizeText(value));
  if (contentMatches.length === 1) return contentMatches[0].id;
  if (contentMatches.length > 1) return null;

  const prefixMatch = value.match(/^([A-Z])[.)\-\s]*(?:.*)?$/i);
  if (prefixMatch) {
    const index = prefixMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (options[index]) return options[index].id;
  }
  if (/^\d+$/.test(value)) return options[Number(value)]?.id ?? null;
  return null;
};

const valuesFromLegacyList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') return parsed.split('|').map((item) => item.trim()).filter(Boolean);
  const record = asRecord(parsed);
  if (Object.keys(record).length > 0) return Object.entries(record).filter(([, selected]) => Boolean(selected)).map(([key]) => key);
  return [];
};

const booleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return null;
};

export const normalizeAnswerForNormalizedQuestion = (
  question: NormalizedGradableQuestion,
  rawInput: unknown,
): NormalizedAnswerResult => {
  const input = unwrapStoredResultAnswer(rawInput);
  const canonical = asRecord(input);

  if (question.type === 'MCQ' || question.type === 'IMAGE_QUESTION') {
    const optionId = optionIdFor(canonical.optionId ?? input, question.options);
    return optionId ? { ok: true, answer: { type: question.type, optionId } } : fail('INVALID_OPTION_SELECTION', 'Selected option does not exist.');
  }

  if (question.type === 'MULTIPLE_SELECT') {
    const values = canonical.optionIds ?? input;
    const rawValues = valuesFromLegacyList(values);
    const optionIds = rawValues.map((value) => optionIdFor(value, question.options));
    if (optionIds.some((value) => !value)) return fail('INVALID_OPTION_SELECTION', 'One or more selected options do not exist.');
    const unique = Array.from(new Set(optionIds.filter((value): value is string => Boolean(value)))).sort();
    return { ok: true, answer: { type: 'MULTIPLE_SELECT', optionIds: unique } };
  }

  if (question.type === 'SHORT_ANSWER' || question.type === 'RIDDLE') {
    return { ok: true, answer: { type: question.type, value: String(canonical.value ?? input ?? '') } };
  }

  if (question.type === 'TRUE_FALSE') {
    const source = asRecord(canonical.values ?? input);
    const values: Record<string, boolean> = {};
    for (const key of Object.keys(question.correctValues)) {
      const parsed = booleanValue(source[key]);
      if (parsed !== null) values[key] = parsed;
    }
    return { ok: true, answer: { type: 'TRUE_FALSE', values } };
  }

  if (question.type === 'MATCHING') {
    const source = withoutUiMetadata(canonical.pairs ?? input);
    const pairs: Record<string, string> = {};
    const usedRightIds = new Set<string>();
    for (const [rawLeft, rawRightValue] of Object.entries(source)) {
      const rawRight = String(rawRightValue ?? '');
      let leftId: string | null = null;
      let rightId: string | null = null;
      const leftIndex = rawLeft.match(/^(?:l|left)-(\d+)$/i);
      const rightIndex = rawRight.match(/^(?:r|right)-(\d+)$/i);
      if (leftIndex) leftId = question.pairs[Number(leftIndex[1])]?.leftId ?? null;
      else {
        const matches = question.pairs.filter((pair) => normalizeText(pair.leftText) === normalizeText(rawLeft));
        if (matches.length > 1) return fail('AMBIGUOUS_LEGACY_MATCHING_CONTENT', 'Legacy matching left content is duplicated.');
        leftId = matches[0]?.leftId ?? null;
      }
      if (rightIndex) rightId = question.pairs[Number(rightIndex[1])]?.rightId ?? null;
      else {
        const matches = question.pairs.filter((pair) => normalizeText(pair.rightText) === normalizeText(rawRight));
        if (matches.length > 1) return fail('AMBIGUOUS_LEGACY_MATCHING_CONTENT', 'Legacy matching right content is duplicated.');
        rightId = matches[0]?.rightId ?? null;
      }
      if (!leftId || !rightId) return fail('INVALID_MATCHING_SELECTION', 'Matching pair cannot be resolved.');
      if (usedRightIds.has(rightId)) return fail('DUPLICATE_MATCHING_TARGET', 'A right item cannot be assigned more than once.');
      pairs[leftId] = rightId;
      usedRightIds.add(rightId);
    }
    return { ok: true, answer: { type: 'MATCHING', pairs } };
  }

  if (question.type === 'DROPDOWN' || question.type === 'DRAG_DROP') {
    const rawValues = canonical.values ?? input;
    const values: Record<string, string> = {};
    if (Array.isArray(rawValues)) {
      rawValues.forEach((value, index) => {
        const blank = question.blanks[index];
        if (blank) values[blank.id] = String(value ?? '');
      });
    } else {
      const source = withoutUiMetadata(rawValues);
      const unresolved: Array<[string, unknown]> = [];
      for (const [key, value] of Object.entries(source)) {
        const direct = question.blanks.find((blank) => blank.id === key || blank.rawToken === key);
        if (direct) values[direct.id] = String(value ?? '');
        else unresolved.push([key, value]);
      }
      if (unresolved.length > 0) {
        const numeric = unresolved.every(([key]) => /^\d+$/.test(key));
        if (!numeric) return fail('INVALID_BLANK_SELECTION', 'One or more blank keys cannot be resolved.');
        const unfilled = question.blanks.filter((blank) => values[blank.id] === undefined);
        unresolved.sort(([left], [right]) => Number(left) - Number(right)).forEach(([, value], index) => {
          const blank = unfilled[index];
          if (blank) values[blank.id] = String(value ?? '');
        });
      }
    }
    return { ok: true, answer: { type: question.type, values } };
  }

  if (question.type === 'ORDERING') {
    const rawRanks = canonical.ranks ?? input;
    const ranks: Record<string, number> = {};
    if (Array.isArray(rawRanks)) {
      rawRanks.forEach((originalIndex, rankIndex) => {
        const item = question.items[Number(originalIndex)];
        if (item) ranks[item.id] = rankIndex + 1;
      });
    } else {
      const source = asRecord(rawRanks);
      Object.entries(source).forEach(([key, value]) => {
        const match = key.match(/^item-(\d+)$/i);
        const item = match ? question.items[Number(match[1])] : question.items[Number(key)];
        if (item) ranks[item.id] = Number(value);
      });
    }
    const values = Object.values(ranks);
    if (values.some((rank) => !Number.isInteger(rank) || rank < 1 || rank > question.items.length) || new Set(values).size !== values.length) {
      return fail('INVALID_ORDERING_RANKS', 'Ordering ranks must be unique integers within range.');
    }
    return { ok: true, answer: { type: 'ORDERING', ranks } };
  }

  if (question.type === 'CATEGORIZATION') {
    const source = asRecord(canonical.categoriesByItemId ?? input);
    const categoriesByItemId = Object.fromEntries(Object.entries(source).filter(([key, value]) => key !== '_selected' && typeof value === 'string').map(([key, value]) => [key, String(value)]));
    if (Object.values(categoriesByItemId).some((categoryId) => !question.categoryIds.includes(categoryId))) return fail('INVALID_CATEGORY_SELECTION', 'Selected category does not exist.');
    return { ok: true, answer: { type: 'CATEGORIZATION', categoriesByItemId } };
  }

  if (question.type === 'UNDERLINE') {
    const source = canonical.indexes ?? input;
    const indexes = Array.isArray(source) ? Array.from(new Set(source.map(Number))).sort((a, b) => a - b) : [];
    if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= question.wordCount)) return fail('INVALID_UNDERLINE_SELECTION', 'Selected word index does not exist.');
    return { ok: true, answer: { type: 'UNDERLINE', indexes } };
  }

  if (question.type === 'WORD_SCRAMBLE') {
    const source = canonical.letterIndexes ?? input;
    const letterIndexes = Array.isArray(source) ? source.map(Number) : [];
    if (letterIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= question.letters.length)) return fail('INVALID_LETTER_SELECTION', 'Selected letter index does not exist.');
    return { ok: true, answer: { type: 'WORD_SCRAMBLE', letterIndexes } };
  }

  const source = asRecord(input);
  return {
    ok: true,
    answer: {
      type: 'ERROR_CORRECTION',
      wrongWord: String(source.wrongWord ?? ''),
      correctWord: String(source.correctWord ?? ''),
    },
  };
};

export const normalizeAnswerForQuestion = (questionInput: unknown, answer: unknown): NormalizedAnswerResult => {
  const normalizedQuestion = normalizeQuestionForGrading(questionInput);
  if (normalizedQuestion.ok === false) return fail(normalizedQuestion.issues[0]?.code ?? 'INVALID_QUESTION_CONTRACT', normalizedQuestion.issues[0]?.message ?? 'Invalid question contract.');
  return normalizeAnswerForNormalizedQuestion(normalizedQuestion.question, answer);
};

export const isCanonicalAnswer = (value: unknown): value is QuizAnswer => {
  const record = asRecord(value);
  return typeof record.type === 'string';
};
