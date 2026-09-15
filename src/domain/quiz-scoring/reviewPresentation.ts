import { isRawAnswerSkipped } from './answerCompleteness';
import { unwrapStoredResultAnswer } from './legacyAnswerAdapters';
import { normalizeAnswerForNormalizedQuestion } from './normalizeAnswer';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import { asArray, asRecord, normalizeText, optionText, parseMaybeJson } from './questionIdentity';
import type {
  GradingStatus,
  NormalizedGradableQuestion,
  QuestionGradingResult,
  QuizAnswer,
} from './types';

export const REVIEW_PRESENTATION_SCHEMA_VERSION = 1 as const;

export type ReviewPresentationSource =
  | 'submission'
  | 'verified-current'
  | 'legacy-unverified';

export type ReviewItemState = 'correct' | 'incorrect' | 'skipped' | 'unknown';

export interface ReviewPresentationOptions {
  source?: ReviewPresentationSource;
}

export interface ReviewPresentationItemBase {
  id: string;
  index: number;
  state: ReviewItemState;
}

export interface ReviewChoiceItem extends ReviewPresentationItemBase {
  text: string;
  selected: boolean;
  correct: boolean;
}

export interface ReviewTrueFalseItem extends ReviewPresentationItemBase {
  statement: string;
  studentValue?: boolean;
  correctValue: boolean;
}

export interface ReviewMatchingItem extends ReviewPresentationItemBase {
  leftId: string;
  leftText: string;
  studentRightId?: string;
  studentRightText?: string;
  correctRightId: string;
  correctRightText: string;
}

export interface ReviewBlankItem extends ReviewPresentationItemBase {
  blankToken?: string;
  studentValue?: string;
  correctValue: string;
}

export interface ReviewOrderingItem extends ReviewPresentationItemBase {
  text: string;
  studentRank?: number;
  correctRank: number;
}

export interface ReviewCategory {
  id: string;
  index: number;
  text: string;
}

export interface ReviewCategorizationItem extends ReviewPresentationItemBase {
  text: string;
  studentCategoryId?: string;
  studentCategoryText?: string;
  correctCategoryId: string;
  correctCategoryText: string;
}

export interface ReviewUnderlineItem extends ReviewPresentationItemBase {
  text: string;
  selected: boolean;
  correct: boolean;
}

export interface ReviewTextAnswerItem extends ReviewPresentationItemBase {
  studentValue?: string;
  correctValues: string[];
}

export interface ReviewWordScrambleItem extends ReviewPresentationItemBase {
  studentValue?: string;
  correctValue: string;
  letters: readonly string[];
  studentLetterIndexes?: readonly number[];
}

export interface ReviewErrorCorrectionItem extends ReviewPresentationItemBase {
  studentWrongWord?: string;
  studentCorrectWord?: string;
  correctWrongWord: string;
  correctWord: string;
}

interface ReviewPresentationBase<T extends string, I extends ReviewPresentationItemBase> {
  schemaVersion: typeof REVIEW_PRESENTATION_SCHEMA_VERSION;
  source: ReviewPresentationSource;
  type: T;
  items: readonly I[];
}

export type ReviewChoicePresentation = ReviewPresentationBase<
  'MCQ' | 'IMAGE_QUESTION' | 'MULTIPLE_SELECT',
  ReviewChoiceItem
>;

export type ReviewTrueFalsePresentation = ReviewPresentationBase<'TRUE_FALSE', ReviewTrueFalseItem>;

export type ReviewMatchingPresentation = ReviewPresentationBase<'MATCHING', ReviewMatchingItem>;

export type ReviewBlankPresentation = ReviewPresentationBase<'DRAG_DROP' | 'DROPDOWN', ReviewBlankItem>;

export type ReviewOrderingPresentation = ReviewPresentationBase<'ORDERING', ReviewOrderingItem>;

export interface ReviewCategorizationPresentation extends ReviewPresentationBase<'CATEGORIZATION', ReviewCategorizationItem> {
  categories: readonly ReviewCategory[];
}

export type ReviewUnderlinePresentation = ReviewPresentationBase<'UNDERLINE', ReviewUnderlineItem>;

export type ReviewTextAnswerPresentation = ReviewPresentationBase<'SHORT_ANSWER' | 'RIDDLE', ReviewTextAnswerItem>;

export type ReviewWordScramblePresentation = ReviewPresentationBase<'WORD_SCRAMBLE', ReviewWordScrambleItem>;

export type ReviewErrorCorrectionPresentation = ReviewPresentationBase<'ERROR_CORRECTION', ReviewErrorCorrectionItem>;

export interface UnsupportedReviewPresentation {
  schemaVersion: typeof REVIEW_PRESENTATION_SCHEMA_VERSION;
  source: ReviewPresentationSource;
  type: 'UNSUPPORTED';
  items: readonly [];
  reason: 'insufficient-authoritative-data' | 'unsupported-question-type' | 'voided-question';
}

export type ReviewPresentation =
  | ReviewChoicePresentation
  | ReviewTrueFalsePresentation
  | ReviewMatchingPresentation
  | ReviewBlankPresentation
  | ReviewOrderingPresentation
  | ReviewCategorizationPresentation
  | ReviewUnderlinePresentation
  | ReviewTextAnswerPresentation
  | ReviewWordScramblePresentation
  | ReviewErrorCorrectionPresentation
  | UnsupportedReviewPresentation;

type PresentationDetail = Pick<QuestionGradingResult, 'questionId' | 'type' | 'status' | 'isCorrect'>;

const sourceOf = (options?: ReviewPresentationOptions): ReviewPresentationSource => (
  options?.source ?? 'legacy-unverified'
);

const base = <T extends string>(
  type: T,
  source: ReviewPresentationSource,
) => ({
  schemaVersion: REVIEW_PRESENTATION_SCHEMA_VERSION,
  source,
  type,
} as const);

const unsupported = (
  source: ReviewPresentationSource,
  reason: UnsupportedReviewPresentation['reason'],
): UnsupportedReviewPresentation => ({
  ...base('UNSUPPORTED', source),
  items: [],
  reason,
});

const stateFromOutcome = (status: GradingStatus | undefined): ReviewItemState => {
  switch (status) {
    case 'correct': return 'correct';
    case 'wrong': return 'incorrect';
    case 'skipped': return 'skipped';
    default: return 'unknown';
  }
};

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

interface PresentationAnswer {
  value: QuizAnswer | null;
  available: boolean;
}

const stringValues = (value: unknown): string[] => {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? '')).filter((item) => item.trim());
  if (parsed === undefined || parsed === null) return [];
  return [String(parsed)];
};

const normalizeAnswer = (
  question: NormalizedGradableQuestion,
  answerInput: unknown,
  detail?: PresentationDetail,
): PresentationAnswer => {
  const selected = unwrapStoredResultAnswer(answerInput);
  if (detail?.status === 'skipped' || isRawAnswerSkipped(selected)) return { value: null, available: true };
  const result = normalizeAnswerForNormalizedQuestion(question, selected);
  return result.ok
    ? { value: result.answer, available: true }
    : { value: null, available: false };
};

const aggregateItemState = (status: GradingStatus | undefined): ReviewItemState => stateFromOutcome(status);

const rawItemText = (item: unknown, fallback: string): string => {
  const record = asRecord(item);
  return optionText(item) || String(record.statement ?? record.content ?? record.text ?? fallback);
};

const buildChoicePresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'MCQ' | 'IMAGE_QUESTION' | 'MULTIPLE_SELECT' }>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewChoicePresentation => {
  const answer = answerState.value;
  const selectedIds = new Set(
    answer?.type === 'MULTIPLE_SELECT'
      ? answer.optionIds
      : answer?.type === 'MCQ' || answer?.type === 'IMAGE_QUESTION'
        ? [answer.optionId]
        : [],
  );
  const correctIds = new Set(
    question.type === 'MULTIPLE_SELECT' ? question.correctOptionIds : [question.correctOptionId],
  );
  const items = question.options.map((option) => {
    const selected = selectedIds.has(option.id);
    const correct = correctIds.has(option.id);
    return {
      id: option.id,
      index: option.index,
      text: option.text,
      selected,
      correct,
      state: !answerState.available
        ? 'unknown'
        : selected ? (correct ? 'correct' : 'incorrect') : correct ? 'skipped' : 'unknown',
    } satisfies ReviewChoiceItem;
  });
  return { ...base(question.type, source), items };
};

const buildTrueFalsePresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'TRUE_FALSE' }>,
  rawQuestion: Record<string, unknown>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewTrueFalsePresentation => {
  const answer = answerState.value;
  const rawItems = asArray(rawQuestion.items);
  const answerValues = answer?.type === 'TRUE_FALSE' ? answer.values : {};
  const items = Object.entries(question.correctValues).map(([id, correctValue], index) => {
    const raw = asRecord(rawItems[index]);
    const statement = rawItemText(rawItems[index], `Mệnh đề ${index + 1}`);
    const hasStudentValue = hasOwn(answerValues, id) && typeof answerValues[id] === 'boolean';
    const studentValue = hasStudentValue ? answerValues[id] : undefined;
    return {
      id,
      index,
      statement: statement || String(raw.statement ?? `Mệnh đề ${index + 1}`),
      ...(studentValue === undefined ? {} : { studentValue }),
      correctValue,
      state: !answerState.available
        ? 'unknown'
        : studentValue === undefined ? 'skipped' : studentValue === correctValue ? 'correct' : 'incorrect',
    } satisfies ReviewTrueFalseItem;
  });
  return { ...base('TRUE_FALSE', source), items };
};

const buildMatchingPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'MATCHING' }>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewMatchingPresentation => {
  const answer = answerState.value;
  const studentPairs = answer?.type === 'MATCHING' ? answer.pairs : {};
  const rightTextById = new Map(question.pairs.map((pair) => [pair.rightId, pair.rightText]));
  const items = question.pairs.map((pair, index) => {
    const studentRightId = studentPairs[pair.leftId];
    return {
      id: pair.leftId,
      index,
      leftId: pair.leftId,
      leftText: pair.leftText,
      ...(studentRightId ? {
        studentRightId,
        studentRightText: rightTextById.get(studentRightId) ?? studentRightId,
      } : {}),
      correctRightId: pair.rightId,
      correctRightText: pair.rightText,
      state: !answerState.available
        ? 'unknown'
        : !studentRightId ? 'skipped' : studentRightId === pair.rightId ? 'correct' : 'incorrect',
    } satisfies ReviewMatchingItem;
  });
  return { ...base('MATCHING', source), items };
};

const buildBlankPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'DROPDOWN' | 'DRAG_DROP' }>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewBlankPresentation => {
  const answer = answerState.value;
  const studentValues = answer?.type === 'DROPDOWN' || answer?.type === 'DRAG_DROP' ? answer.values : {};
  const items = question.blanks.map((blank) => {
    const hasStudentValue = hasOwn(studentValues, blank.id) && String(studentValues[blank.id] ?? '').trim().length > 0;
    const studentValue = hasStudentValue ? String(studentValues[blank.id]) : undefined;
    return {
      id: blank.id,
      index: blank.index,
      ...(blank.rawToken ? { blankToken: blank.rawToken } : {}),
      ...(studentValue === undefined ? {} : { studentValue }),
      correctValue: blank.correctAnswer,
      state: !answerState.available
        ? 'unknown'
        : studentValue === undefined
          ? 'skipped'
          : normalizeText(studentValue) === normalizeText(blank.correctAnswer) ? 'correct' : 'incorrect',
    } satisfies ReviewBlankItem;
  });
  return { ...base(question.type, source), items };
};

const buildOrderingPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'ORDERING' }>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewOrderingPresentation => {
  const answer = answerState.value;
  const studentRanks = answer?.type === 'ORDERING' ? answer.ranks : {};
  const items = question.items.map((item) => {
    const studentRank = studentRanks[item.id];
    const hasStudentRank = Number.isInteger(studentRank);
    return {
      id: item.id,
      index: item.index,
      text: item.text,
      ...(hasStudentRank ? { studentRank } : {}),
      correctRank: question.correctRanks[item.id],
      state: !answerState.available
        ? 'unknown'
        : !hasStudentRank ? 'skipped' : studentRank === question.correctRanks[item.id] ? 'correct' : 'incorrect',
    } satisfies ReviewOrderingItem;
  });
  return { ...base('ORDERING', source), items };
};

const buildCategorizationPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'CATEGORIZATION' }>,
  rawQuestion: Record<string, unknown>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewCategorizationPresentation => {
  const answer = answerState.value;
  const rawCategories = asArray(rawQuestion.categories ?? rawQuestion.distractors);
  const categories = rawCategories.map((category, index) => {
    const record = asRecord(category);
    return {
      id: String(record.id ?? `category-${index}`),
      index,
      text: String(record.name ?? record.label ?? optionText(category)),
    } satisfies ReviewCategory;
  });
  const categoryTextById = new Map(categories.map((category) => [category.id, category.text]));
  const rawItems = asArray(rawQuestion.items);
  const studentCategories = answer?.type === 'CATEGORIZATION' ? answer.categoriesByItemId : {};
  const items = Object.entries(question.correctCategories).map(([itemId, correctCategoryId], index) => {
    const rawItemValue = rawItems.find((item) => String(asRecord(item).id ?? '') === itemId) ?? rawItems[index];
    const studentCategoryId = studentCategories[itemId];
    return {
      id: itemId,
      index,
      text: rawItemText(rawItemValue, `Mục ${index + 1}`),
      ...(studentCategoryId ? {
        studentCategoryId,
        studentCategoryText: categoryTextById.get(studentCategoryId) ?? studentCategoryId,
      } : {}),
      correctCategoryId,
      correctCategoryText: categoryTextById.get(correctCategoryId) ?? correctCategoryId,
      state: !answerState.available
        ? 'unknown'
        : !studentCategoryId ? 'skipped' : studentCategoryId === correctCategoryId ? 'correct' : 'incorrect',
    } satisfies ReviewCategorizationItem;
  });
  return { ...base('CATEGORIZATION', source), items, categories };
};

const buildUnderlinePresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'UNDERLINE' }>,
  rawQuestion: Record<string, unknown>,
  answerState: PresentationAnswer,
  source: ReviewPresentationSource,
): ReviewUnderlinePresentation => {
  const answer = answerState.value;
  const words = asArray(rawQuestion.words ?? rawQuestion.items).map(optionText);
  const selectedIndexes = new Set(answer?.type === 'UNDERLINE' ? answer.indexes : []);
  const correctIndexes = new Set(question.correctIndexes);
  const items = words.map((text, index) => {
    const selected = selectedIndexes.has(index);
    const correct = correctIndexes.has(index);
    return {
      id: `word-${index}`,
      index,
      text,
      selected,
      correct,
      state: !answerState.available
        ? 'unknown'
        : selected ? (correct ? 'correct' : 'incorrect') : correct ? 'skipped' : 'unknown',
    } satisfies ReviewUnderlineItem;
  });
  return { ...base('UNDERLINE', source), items };
};

const buildTextAnswerPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'SHORT_ANSWER' | 'RIDDLE' }>,
  rawQuestion: Record<string, unknown>,
  answerState: PresentationAnswer,
  detail: PresentationDetail | undefined,
  source: ReviewPresentationSource,
): ReviewTextAnswerPresentation => {
  const answer = answerState.value;
  const correctSource = rawQuestion.correctAnswers ?? rawQuestion.correctAnswer ?? rawQuestion.correct_answer;
  const correctValues = stringValues(correctSource).length > 0
    ? stringValues(correctSource)
    : question.acceptedValues;
  const studentValue = answer?.type === question.type ? String(answer.value) : undefined;
  return {
    ...base(question.type, source),
    items: [{
      id: 'answer',
      index: 0,
      ...(studentValue === undefined ? {} : { studentValue }),
      correctValues,
      state: answerState.available ? aggregateItemState(detail?.status) : 'unknown',
    } satisfies ReviewTextAnswerItem],
  };
};

const buildWordScramblePresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'WORD_SCRAMBLE' }>,
  rawQuestion: Record<string, unknown>,
  answerState: PresentationAnswer,
  detail: PresentationDetail | undefined,
  source: ReviewPresentationSource,
): ReviewWordScramblePresentation => {
  const answer = answerState.value;
  return {
    ...base('WORD_SCRAMBLE', source),
    items: [{
      id: 'answer',
      index: 0,
      ...(answer?.type === 'WORD_SCRAMBLE' ? {
        studentValue: answer.letterIndexes.map((index) => question.letters[index] ?? '').join(''),
        studentLetterIndexes: answer.letterIndexes,
      } : {}),
      correctValue: String(rawQuestion.correctWord ?? rawQuestion.correctAnswer ?? rawQuestion.correct_answer ?? question.correctWord),
      letters: question.letters,
      state: answerState.available ? aggregateItemState(detail?.status) : 'unknown',
    } satisfies ReviewWordScrambleItem],
  };
};

const buildErrorCorrectionPresentation = (
  question: Extract<NormalizedGradableQuestion, { type: 'ERROR_CORRECTION' }>,
  answerState: PresentationAnswer,
  detail: PresentationDetail | undefined,
  source: ReviewPresentationSource,
): ReviewErrorCorrectionPresentation => {
  const answer = answerState.value;
  return {
    ...base('ERROR_CORRECTION', source),
    items: [{
      id: 'correction',
      index: 0,
      ...(answer?.type === 'ERROR_CORRECTION' ? {
        studentWrongWord: answer.wrongWord,
        studentCorrectWord: answer.correctWord,
      } : {}),
      correctWrongWord: question.wrongWord,
      correctWord: question.correctWord,
      state: answerState.available ? aggregateItemState(detail?.status) : 'unknown',
    } satisfies ReviewErrorCorrectionItem],
  };
};

export const buildQuestionAnswerPresentation = (
  questionInput: unknown,
  answerInput: unknown,
  detail?: PresentationDetail,
  options?: ReviewPresentationOptions,
): ReviewPresentation => {
  const source = sourceOf(options);
  if (detail?.status === 'voided') return unsupported(source, 'voided-question');

  const normalized = normalizeQuestionForGrading(questionInput);
  if (!normalized.ok) return unsupported(source, 'insufficient-authoritative-data');

  const rawQuestion = asRecord(questionInput);
  const answerState = normalizeAnswer(normalized.question, answerInput, detail);
  switch (normalized.question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
    case 'MULTIPLE_SELECT':
      return buildChoicePresentation(normalized.question, answerState, source);
    case 'TRUE_FALSE':
      return buildTrueFalsePresentation(normalized.question, rawQuestion, answerState, source);
    case 'MATCHING':
      return buildMatchingPresentation(normalized.question, answerState, source);
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return buildBlankPresentation(normalized.question, answerState, source);
    case 'ORDERING':
      return buildOrderingPresentation(normalized.question, answerState, source);
    case 'CATEGORIZATION':
      return buildCategorizationPresentation(normalized.question, rawQuestion, answerState, source);
    case 'UNDERLINE':
      return buildUnderlinePresentation(normalized.question, rawQuestion, answerState, source);
    case 'SHORT_ANSWER':
    case 'RIDDLE':
      return buildTextAnswerPresentation(normalized.question, rawQuestion, answerState, detail, source);
    case 'WORD_SCRAMBLE':
      return buildWordScramblePresentation(normalized.question, rawQuestion, answerState, detail, source);
    case 'ERROR_CORRECTION':
      return buildErrorCorrectionPresentation(normalized.question, answerState, detail, source);
  }
};

export const buildReviewPresentation = buildQuestionAnswerPresentation;
