import { z } from 'zod';

export const NonEmptyText = z.string().trim().min(1);
export const QuestionText = NonEmptyText.max(4_000);
export const ExplanationText = NonEmptyText.max(6_000);
export const DifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export const OptionalImage = z.string().trim().min(1).max(2_000_000).optional();

export const CommonGeneratedQuestionFields = {
  slotId: z.string().trim().regex(/^slot-\d+$/),
  difficulty: DifficultySchema,
  explanation: ExplanationText,
  subject: z.enum(['math', 'vietnamese']).optional(),
  skillCode: z.string().trim().min(1).max(160).optional(),
  subskillCode: z.string().trim().min(1).max(160).optional(),
};

export const normalizeComparableText = (value: string): string => value
  .normalize('NFC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi');

export const answerLetterIndex = (value: string): number => value.charCodeAt(0) - 65;

export const extractSequentialMarkers = (text: string): string[] => [...text.matchAll(/\[(\d+)\]/g)]
  .map((match) => match[1]);

export const hasSequentialMarkers = (markers: readonly string[]): boolean => markers.every(
  (marker, index) => marker === String(index + 1),
);

export const uniqueNormalizedValues = (values: readonly string[]): boolean => {
  const normalized = values.map(normalizeComparableText);
  return new Set(normalized).size === normalized.length;
};

export const sameCharacterMultiset = (left: string, right: string): boolean => {
  const normalize = (value: string) => Array.from(value.normalize('NFC').replace(/\s+/g, ''))
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .join('');
  return normalize(left) === normalize(right);
};
