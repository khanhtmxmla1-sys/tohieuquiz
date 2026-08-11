import {
  asArray,
  asRecord,
  buildOptions,
  extractPlaceholderTokens,
  getBlankId,
  getMatchingLeftId,
  getMatchingRightId,
  getOrderingItemId,
  hasDuplicateNormalizedText,
  normalizeText,
  parseMaybeJson,
} from './questionIdentity';
import type {
  GradingIssue,
  NormalizedGradableQuestion,
  NormalizedQuestionResult,
  PublishedQuestionType,
} from './types';

const TYPE_ALIASES: Record<string, PublishedQuestionType> = {
  MCQ: 'MCQ',
  MULTIPLE_CHOICE: 'MCQ',
  IMAGE: 'IMAGE_QUESTION',
  IMAGE_MCQ: 'IMAGE_QUESTION',
  IMAGE_QUESTION: 'IMAGE_QUESTION',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT',
  SHORT_ANSWER: 'SHORT_ANSWER',
  MATH_INPUT: 'SHORT_ANSWER',
  TRUE_FALSE: 'TRUE_FALSE',
  MATCHING: 'MATCHING',
  DRAG_DROP: 'DRAG_DROP',
  DROPDOWN: 'DROPDOWN',
  FILL_IN_THE_BLANK: 'DROPDOWN',
  ORDERING: 'ORDERING',
  CATEGORIZATION: 'CATEGORIZATION',
  UNDERLINE: 'UNDERLINE',
  WORD_SCRAMBLE: 'WORD_SCRAMBLE',
  RIDDLE: 'RIDDLE',
  ERROR_CORRECTION: 'ERROR_CORRECTION',
};

const issue = (questionId: string, code: string, message: string): GradingIssue => ({ questionId, code, message });

const parseCorrectValues = (value: unknown): unknown[] => {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') return parsed.split('|').map((item) => item.trim()).filter(Boolean);
  if (parsed === undefined || parsed === null) return [];
  return [parsed];
};

const firstNonEmptyCorrectValues = (...sources: unknown[]): unknown[] => {
  for (const source of sources) {
    const values = parseCorrectValues(source);
    if (values.length > 0) return values;
  }
  return [];
};

const resolveOptionId = (raw: unknown, options: ReturnType<typeof buildOptions>): string | null => {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const optionIdMatch = value.match(/^option-(\d+)$/i);
  if (optionIdMatch) return options[Number(optionIdMatch[1])]?.id ?? null;

  const labelMatch = value.match(/^([A-Z])[.)\-\s]*(?:.*)?$/i);
  if (labelMatch && /^[A-Z]$/i.test(value.charAt(0))) {
    const index = labelMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (options[index]) return options[index].id;
  }

  const contentMatches = options.filter((option) => normalizeText(option.text) === normalizeText(value));
  if (contentMatches.length === 1) return contentMatches[0].id;

  if (/^\d+$/.test(value)) {
    const index = Number(value);
    if (options[index]) return options[index].id;
  }
  return null;
};

export const normalizeQuestionForGrading = (input: unknown): NormalizedQuestionResult => {
  const raw = asRecord(input);
  const id = String(raw.id ?? '').trim();
  const originalType = String(raw.type ?? raw.questionType ?? '').trim().toUpperCase().replace(/-/g, '_');
  if (!id) return { ok: false, questionId: '', type: originalType, issues: [issue('', 'MISSING_QUESTION_ID', 'Question ID is required.')] };
  if (originalType === 'GEOMETRY') {
    return { ok: false, questionId: id, type: originalType, issues: [issue(id, 'QUESTION_NOT_AUTO_GRADABLE', 'Geometry questions do not have an auto-grading contract.')] };
  }
  const type = TYPE_ALIASES[originalType];
  if (!type) return { ok: false, questionId: id, type: originalType, issues: [issue(id, 'UNSUPPORTED_QUESTION_TYPE', `Unsupported question type: ${originalType || 'UNKNOWN'}.`)] };

  if (type === 'MCQ' || type === 'IMAGE_QUESTION') {
    const options = buildOptions(raw.options);
    const correctOptionId = resolveOptionId(raw.correctAnswer ?? raw.correct_answer, options);
    if (options.length < 2 || !correctOptionId) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_CHOICE_CONTRACT', 'Choice question requires at least two options and a resolvable correct option.')] };
    }
    return { ok: true, question: { id, type, originalType, options, correctOptionId } };
  }

  if (type === 'MULTIPLE_SELECT') {
    const options = buildOptions(raw.options);
    const correctValues = firstNonEmptyCorrectValues(raw.correctAnswers, raw.correctAnswer, raw.correct_answer);
    const correctOptionIds = Array.from(new Set(correctValues.map((value) => resolveOptionId(value, options)).filter((value): value is string => Boolean(value)))).sort();
    if (options.length < 2 || correctOptionIds.length === 0 || correctOptionIds.length !== correctValues.length) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_MULTIPLE_SELECT_CONTRACT', 'Every correct choice must resolve to an existing option.')] };
    }
    return { ok: true, question: { id, type, originalType, options, correctOptionIds } };
  }

  if (type === 'SHORT_ANSWER' || type === 'RIDDLE') {
    const values = firstNonEmptyCorrectValues(raw.correctAnswers, raw.correctAnswer, raw.correct_answer).map(normalizeText).filter(Boolean);
    if (values.length === 0) return { ok: false, questionId: id, type, issues: [issue(id, 'MISSING_CORRECT_ANSWER', 'A correct answer is required.')] };
    return { ok: true, question: { id, type, originalType, acceptedValues: Array.from(new Set(values)) } };
  }

  if (type === 'TRUE_FALSE') {
    const items = asArray(raw.items);
    const correctValues: Record<string, boolean> = {};
    items.forEach((item, index) => {
      const record = asRecord(item);
      const itemId = String(record.id ?? `item-${index}`);
      if (typeof record.isCorrect === 'boolean') correctValues[itemId] = record.isCorrect;
    });
    if (Object.keys(correctValues).length !== items.length || items.length === 0) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_TRUE_FALSE_CONTRACT', 'Every true/false item must have a boolean correct value.')] };
    }
    return { ok: true, question: { id, type, originalType, correctValues } };
  }

  if (type === 'MATCHING') {
    const configuredPairs = asArray(raw.pairs);
    const legacyItems = asArray(raw.items);
    const leftItems = asArray(raw.leftItems ?? raw.left_items);
    const rightItems = asArray(raw.rightItems ?? raw.right_items);
    const source = configuredPairs.length > 0
      ? configuredPairs
      : legacyItems.length > 0
        ? legacyItems
        : leftItems.map((left, index) => ({
            left: asRecord(left).content ?? asRecord(left).text ?? left,
            right: asRecord(rightItems[index]).content ?? asRecord(rightItems[index]).text ?? rightItems[index],
          }));
    const pairs = source.map((pair, index) => {
      const record = asRecord(pair);
      return {
        leftId: getMatchingLeftId(index),
        rightId: getMatchingRightId(index),
        leftText: String(record.left ?? ''),
        rightText: String(record.right ?? ''),
      };
    });
    if (pairs.length === 0 || pairs.some((pair) => !pair.leftText || !pair.rightText)) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_MATCHING_CONTRACT', 'Matching pairs require non-empty left and right content.')] };
    }
    const correctPairs = Object.fromEntries(pairs.map((pair) => [pair.leftId, pair.rightId]));
    return {
      ok: true,
      question: {
        id,
        type,
        originalType,
        pairs,
        correctPairs,
        duplicateLeftText: hasDuplicateNormalizedText(pairs.map((pair) => pair.leftText)),
        duplicateRightText: hasDuplicateNormalizedText(pairs.map((pair) => pair.rightText)),
      },
    };
  }

  if (type === 'DROPDOWN' || type === 'DRAG_DROP') {
    const source = asArray(raw.blanks);
    const placeholderTokens = extractPlaceholderTokens(raw.text ?? raw.question);
    const blanks = source.map((blank, index) => {
      const record = asRecord(blank);
      const objectBlank = Object.keys(record).length > 0;
      const correctAnswer = objectBlank
        ? String(record.correctAnswer ?? record.value ?? '')
        : String(blank ?? '');
      return {
        id: getBlankId(raw, index),
        index,
        rawToken: placeholderTokens[index],
        correctAnswer,
        options: asArray(record.options).map(String),
      };
    });
    const ids = blanks.map((blank) => blank.id);
    if (blanks.length === 0 || blanks.some((blank) => !blank.id || !blank.correctAnswer) || new Set(ids).size !== ids.length) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_BLANK_CONTRACT', 'Blanks require unique IDs and non-empty correct answers.')] };
    }
    const correctValues = Object.fromEntries(blanks.map((blank) => [blank.id, blank.correctAnswer]));
    return { ok: true, question: { id, type, originalType, blanks, correctValues } };
  }

  if (type === 'ORDERING') {
    const source = asArray(raw.items);
    const items = source.map((item, index) => ({ id: getOrderingItemId(index), index, text: String(asRecord(item).content ?? asRecord(item).text ?? item ?? '') }));
    const orderRaw = parseMaybeJson(raw.correctOrder ?? raw.correctAnswer ?? raw.correct_answer);
    const order = Array.isArray(orderRaw) ? orderRaw.map(Number) : [];
    const valid = items.length > 0 && order.length === items.length && order.every((index) => Number.isInteger(index) && index >= 0 && index < items.length) && new Set(order).size === order.length;
    if (!valid) return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_ORDERING_CONTRACT', 'Correct order must be a complete permutation of item indexes.')] };
    const correctRanks: Record<string, number> = {};
    order.forEach((originalIndex, rankIndex) => { correctRanks[getOrderingItemId(originalIndex)] = rankIndex + 1; });
    return { ok: true, question: { id, type, originalType, items, correctRanks } };
  }

  if (type === 'CATEGORIZATION') {
    const categories = asArray(raw.categories ?? raw.distractors).map((category) => String(asRecord(category).id ?? '')).filter(Boolean);
    const items = asArray(raw.items);
    const correctCategories: Record<string, string> = {};
    items.forEach((item) => {
      const record = asRecord(item);
      const itemId = String(record.id ?? '');
      const categoryId = String(record.categoryId ?? '');
      if (itemId && categoryId) correctCategories[itemId] = categoryId;
    });
    if (categories.length === 0 || Object.keys(correctCategories).length !== items.length || Object.values(correctCategories).some((categoryId) => !categories.includes(categoryId))) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_CATEGORIZATION_CONTRACT', 'Every item must reference an existing category ID.')] };
    }
    return { ok: true, question: { id, type, originalType, correctCategories, categoryIds: categories } };
  }

  if (type === 'UNDERLINE') {
    const words = asArray(raw.words ?? raw.items);
    const indexesRaw = parseMaybeJson(raw.correctWordIndexes ?? raw.correctAnswer ?? raw.correct_answer);
    const correctIndexes = Array.isArray(indexesRaw) ? Array.from(new Set(indexesRaw.map(Number))).sort((a, b) => a - b) : [];
    if (words.length === 0 || correctIndexes.length === 0 || correctIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= words.length)) {
      return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_UNDERLINE_CONTRACT', 'Underline indexes must reference existing words.')] };
    }
    return { ok: true, question: { id, type, originalType, correctIndexes, wordCount: words.length } };
  }

  if (type === 'WORD_SCRAMBLE') {
    const letters = asArray(raw.letters ?? raw.items).map(String);
    const correctWord = normalizeText(raw.correctWord ?? raw.correctAnswer ?? raw.correct_answer).replace(/\s+/g, '');
    if (letters.length < 2 || !correctWord) return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_WORD_SCRAMBLE_CONTRACT', 'Word scramble requires letters and a correct word.')] };
    return { ok: true, question: { id, type, originalType, letters, correctWord } };
  }

  const wrongWord = normalizeText(raw.wrongWord ?? raw.distractors);
  const correctWord = normalizeText(raw.correctWord ?? raw.correctAnswer ?? raw.correct_answer);
  if (!wrongWord || !correctWord) return { ok: false, questionId: id, type, issues: [issue(id, 'INVALID_ERROR_CORRECTION_CONTRACT', 'Wrong and corrected words are required.')] };
  const question: NormalizedGradableQuestion = { id, type: 'ERROR_CORRECTION', originalType, wrongWord, correctWord };
  return { ok: true, question };
};
