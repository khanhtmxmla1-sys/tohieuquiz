import { QuestionType } from '../../../types';

export type QuestionTypeAvailability =
  | 'aiSelectable'
  | 'manualOnly'
  | 'experimentalLegacy';

export type AiSelectableQuestionType =
  | QuestionType.MCQ
  | QuestionType.TRUE_FALSE
  | QuestionType.SHORT_ANSWER
  | QuestionType.MATCHING
  | QuestionType.MULTIPLE_SELECT
  | QuestionType.DRAG_DROP
  | QuestionType.ORDERING
  | QuestionType.IMAGE_QUESTION
  | QuestionType.DROPDOWN
  | QuestionType.UNDERLINE
  | QuestionType.CATEGORIZATION
  | QuestionType.WORD_SCRAMBLE
  | QuestionType.RIDDLE;

export const AI_SELECTABLE_QUESTION_TYPES = [
  QuestionType.MCQ,
  QuestionType.TRUE_FALSE,
  QuestionType.SHORT_ANSWER,
  QuestionType.MATCHING,
  QuestionType.MULTIPLE_SELECT,
  QuestionType.DRAG_DROP,
  QuestionType.ORDERING,
  QuestionType.IMAGE_QUESTION,
  QuestionType.DROPDOWN,
  QuestionType.UNDERLINE,
  QuestionType.CATEGORIZATION,
  QuestionType.WORD_SCRAMBLE,
  QuestionType.RIDDLE,
] as const satisfies readonly AiSelectableQuestionType[];

export const MANUAL_ONLY_QUESTION_TYPES = [
  QuestionType.ERROR_CORRECTION,
] as const;

export const EXPERIMENTAL_LEGACY_QUESTION_TYPES = [
  QuestionType.GEOMETRY,
] as const;

const availabilityByType = new Map<QuestionType, QuestionTypeAvailability>([
  ...AI_SELECTABLE_QUESTION_TYPES.map((type) => [type, 'aiSelectable'] as const),
  ...MANUAL_ONLY_QUESTION_TYPES.map((type) => [type, 'manualOnly'] as const),
  ...EXPERIMENTAL_LEGACY_QUESTION_TYPES.map((type) => [type, 'experimentalLegacy'] as const),
]);

export function getQuestionTypeAvailability(type: QuestionType): QuestionTypeAvailability {
  const availability = availabilityByType.get(type);
  if (!availability) {
    throw new Error(`Dạng câu hỏi chưa được phân loại: ${type}`);
  }
  return availability;
}

export function isAiSelectableQuestionType(
  type: QuestionType,
): type is AiSelectableQuestionType {
  return getQuestionTypeAvailability(type) === 'aiSelectable';
}
