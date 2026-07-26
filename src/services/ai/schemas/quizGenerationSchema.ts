import { z } from 'zod';
import { QuestionType } from '../../../types';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from '../question-contracts/questionContract.types';
import { getAiQuestionContract } from '../question-contracts/questionContractRegistry';

const NonEmptyText = z.string().trim().min(1);
const QuestionText = NonEmptyText.max(4000);
const ExplanationText = NonEmptyText.max(6000);
const DifficultyLevel = z.number().int().min(1).max(3);
const OptionalImage = z.string().trim().min(1).max(2_000_000).optional();

const CommonMetadataFields = {
  id: z.string().trim().min(1).max(160).optional(),
  explanation: ExplanationText,
  difficultyLevel: DifficultyLevel,
};

const McqSchema = z.object({
  type: z.literal(QuestionType.MCQ),
  question: QuestionText,
  options: z.array(NonEmptyText.max(1000)).min(2).max(6),
  correctAnswer: z.string().trim().regex(/^[A-Z]$/),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const MultipleSelectSchema = z.object({
  type: z.literal(QuestionType.MULTIPLE_SELECT),
  question: QuestionText,
  options: z.array(NonEmptyText.max(1000)).min(3).max(6),
  correctAnswers: z.array(z.string().trim().regex(/^[A-Z]$/)).min(2).max(3),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const TrueFalseSchema = z.object({
  type: z.literal(QuestionType.TRUE_FALSE),
  mainQuestion: QuestionText,
  items: z.array(z.object({
    id: z.string().trim().min(1).max(160).optional(),
    statement: QuestionText,
    isCorrect: z.boolean(),
  })).min(2).max(4),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const ShortAnswerSchema = z.object({
  type: z.literal(QuestionType.SHORT_ANSWER),
  question: QuestionText,
  correctAnswer: NonEmptyText.max(1000),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const MatchingSchema = z.object({
  type: z.literal(QuestionType.MATCHING),
  question: QuestionText,
  pairs: z.array(z.object({
    left: NonEmptyText.max(1000),
    right: NonEmptyText.max(1000),
    image: OptionalImage,
  })).min(3).max(6),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const DragDropSchema = z.object({
  type: z.literal(QuestionType.DRAG_DROP),
  question: QuestionText,
  text: QuestionText,
  blanks: z.array(NonEmptyText.max(500)).min(1).max(12),
  distractors: z.array(NonEmptyText.max(500)).max(20),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const OrderingItemSchema = z.union([
  NonEmptyText.max(2000),
  z.object({
    id: z.string().trim().min(1).max(160),
    content: NonEmptyText.max(2000),
  }),
]);

const OrderingSchema = z.object({
  type: z.literal(QuestionType.ORDERING),
  question: QuestionText,
  items: z.array(OrderingItemSchema).min(2).max(12),
  correctOrder: z.array(z.union([
    z.number().int().min(0),
    z.string().trim().min(1).max(160),
  ])).min(2).max(12),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const ImageQuestionSchema = z.object({
  type: z.literal(QuestionType.IMAGE_QUESTION),
  question: QuestionText,
  image: z.string().trim().min(1).max(2_000_000),
  options: z.array(NonEmptyText.max(1000)).min(2).max(6),
  optionImages: z.array(z.string().trim().min(1).max(2_000_000)).max(6).optional(),
  correctAnswer: z.string().trim().regex(/^[A-Z]$/),
  ...CommonMetadataFields,
});

const DropdownBlankSchema = z.object({
  id: z.string().trim().min(1).max(160),
  options: z.array(NonEmptyText.max(500)).min(2).max(8),
  correctAnswer: NonEmptyText.max(500),
});

const DropdownSchema = z.object({
  type: z.literal(QuestionType.DROPDOWN),
  question: QuestionText,
  text: QuestionText,
  blanks: z.array(DropdownBlankSchema).min(1).max(12),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const UnderlineSchema = z.object({
  type: z.literal(QuestionType.UNDERLINE),
  question: QuestionText,
  sentence: QuestionText,
  words: z.array(NonEmptyText.max(500)).min(1).max(100),
  correctWordIndexes: z.array(z.number().int().min(0)).min(1).max(100),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const CategorizationSchema = z.object({
  type: z.literal(QuestionType.CATEGORIZATION),
  question: QuestionText,
  instruction: z.string().trim().min(1).max(2000).optional(),
  categories: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    name: NonEmptyText.max(1000),
  })).min(2).max(8),
  items: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    content: NonEmptyText.max(2000),
    categoryId: z.string().trim().min(1).max(160),
  })).min(1).max(40),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const WordScrambleSchema = z.object({
  type: z.literal(QuestionType.WORD_SCRAMBLE),
  question: QuestionText,
  letters: z.array(NonEmptyText.max(20)).min(2).max(40),
  correctWord: NonEmptyText.max(200),
  hint: z.string().trim().min(1).max(1000).optional(),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const RiddleSchema = z.object({
  type: z.literal(QuestionType.RIDDLE),
  question: QuestionText,
  riddleLines: z.array(NonEmptyText.max(1000)).min(1).max(12),
  correctAnswer: NonEmptyText.max(500),
  answerType: z.enum(['original', 'transformed']),
  answerLabel: NonEmptyText.max(500),
  hint: z.string().trim().min(1).max(1000).optional(),
  image: OptionalImage,
  ...CommonMetadataFields,
});

const addIssue = (ctx: z.RefinementCtx, message: string, path: PropertyKey[]) => {
  ctx.addIssue({ code: 'custom', message, path });
};

const answerIndex = (answer: string): number => answer.charCodeAt(0) - 65;

export const GeneratedQuestionSchema = z.discriminatedUnion('type', [
  McqSchema,
  MultipleSelectSchema,
  TrueFalseSchema,
  ShortAnswerSchema,
  MatchingSchema,
  DragDropSchema,
  OrderingSchema,
  ImageQuestionSchema,
  DropdownSchema,
  UnderlineSchema,
  CategorizationSchema,
  WordScrambleSchema,
  RiddleSchema,
]).superRefine((question, ctx) => {
  if (question.type === QuestionType.MCQ || question.type === QuestionType.IMAGE_QUESTION) {
    if (answerIndex(question.correctAnswer) >= question.options.length) {
      addIssue(ctx, 'Đáp án đúng phải tham chiếu một phương án hiện có.', ['correctAnswer']);
    }
  }

  if (question.type === QuestionType.MULTIPLE_SELECT) {
    const uniqueAnswers = new Set(question.correctAnswers);
    if (uniqueAnswers.size !== question.correctAnswers.length) {
      addIssue(ctx, 'Các đáp án đúng không được trùng nhau.', ['correctAnswers']);
    }
    if (question.correctAnswers.some((answer) => answerIndex(answer) >= question.options.length)) {
      addIssue(ctx, 'Mọi đáp án đúng phải tham chiếu phương án hiện có.', ['correctAnswers']);
    }
  }

  if (question.type === QuestionType.MATCHING) {
    const pairKeys = question.pairs.map(({ left, right }) => `${left}\u0000${right}`);
    if (new Set(pairKeys).size !== pairKeys.length) {
      addIssue(ctx, 'Các cặp nối phải khác nhau.', ['pairs']);
    }
    if (new Set(question.pairs.map(({ left }) => left)).size !== question.pairs.length
      || new Set(question.pairs.map(({ right }) => right)).size !== question.pairs.length) {
      addIssue(ctx, 'Mỗi vế trong câu nối phải là duy nhất.', ['pairs']);
    }
  }

  if (question.type === QuestionType.DRAG_DROP) {
    const placeholders = question.text.match(/\[[^\]]+\]/g) ?? [];
    if (placeholders.length !== question.blanks.length) {
      addIssue(ctx, 'Số chỗ trống trong văn bản phải bằng số đáp án blanks.', ['blanks']);
    }
  }

  if (question.type === QuestionType.ORDERING) {
    if (question.correctOrder.length !== question.items.length) {
      addIssue(ctx, 'correctOrder phải chứa đúng một phần tử cho mỗi item.', ['correctOrder']);
    } else if (question.correctOrder.every((value) => typeof value === 'number')) {
      const expected = question.items.map((_, index) => index).sort((a, b) => a - b);
      const actual = [...question.correctOrder].sort((a, b) => Number(a) - Number(b));
      if (actual.some((value, index) => value !== expected[index])) {
        addIssue(ctx, 'correctOrder phải là hoán vị của chỉ số item.', ['correctOrder']);
      }
    } else if (question.correctOrder.every((value) => typeof value === 'string')
      && question.items.every((item) => typeof item !== 'string')) {
      const expectedIds = new Set(question.items.map((item) => typeof item === 'string' ? '' : item.id));
      const actualIds = new Set(question.correctOrder as string[]);
      if (actualIds.size !== question.correctOrder.length
        || actualIds.size !== expectedIds.size
        || [...actualIds].some((id) => !expectedIds.has(id))) {
        addIssue(ctx, 'correctOrder phải là hoán vị của ID item.', ['correctOrder']);
      }
    } else {
      addIssue(ctx, 'correctOrder phải dùng toàn bộ chỉ số hoặc toàn bộ ID item.', ['correctOrder']);
    }
  }

  if (question.type === QuestionType.DROPDOWN) {
    const blankIds = question.blanks.map(({ id }) => id);
    if (new Set(blankIds).size !== blankIds.length) {
      addIssue(ctx, 'ID của các ô dropdown phải khác nhau.', ['blanks']);
    }
    question.blanks.forEach((blank, index) => {
      if (new Set(blank.options).size !== blank.options.length) {
        addIssue(ctx, 'Lựa chọn dropdown không được trùng nhau.', ['blanks', index, 'options']);
      }
      if (!blank.options.includes(blank.correctAnswer)) {
        addIssue(ctx, 'Đáp án dropdown phải thuộc danh sách lựa chọn.', ['blanks', index, 'correctAnswer']);
      }
    });
  }

  if (question.type === QuestionType.UNDERLINE) {
    const indexes = question.correctWordIndexes;
    if (new Set(indexes).size !== indexes.length) {
      addIssue(ctx, 'Chỉ số từ đúng không được trùng nhau.', ['correctWordIndexes']);
    }
    if (indexes.some((index) => index >= question.words.length)) {
      addIssue(ctx, 'Chỉ số từ đúng phải nằm trong mảng words.', ['correctWordIndexes']);
    }
  }

  if (question.type === QuestionType.CATEGORIZATION) {
    const categoryIds = question.categories.map(({ id }) => id);
    if (new Set(categoryIds).size !== categoryIds.length) {
      addIssue(ctx, 'ID nhóm phân loại phải khác nhau.', ['categories']);
    }
    const categoryIdSet = new Set(categoryIds);
    const itemIds = question.items.map(({ id }) => id);
    if (new Set(itemIds).size !== itemIds.length) {
      addIssue(ctx, 'ID mục phân loại phải khác nhau.', ['items']);
    }
    question.items.forEach((item, index) => {
      if (!categoryIdSet.has(item.categoryId)) {
        addIssue(ctx, 'categoryId phải tham chiếu một nhóm hiện có.', ['items', index, 'categoryId']);
      }
    });
  }
});

export const GeneratedQuizSchema = z.object({
  title: NonEmptyText.max(500),
  detectedCategory: z.string().trim().min(1).max(100).optional(),
  detectedLesson: z.string().trim().min(1).max(500).optional(),
  suggestedTags: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  timeLimit: z.number().int().min(1).max(600).optional(),
  questions: z.array(GeneratedQuestionSchema).min(1).max(40),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;
export type GeneratedQuizPayload = z.infer<typeof GeneratedQuizSchema>;

export function parseGeneratedQuiz(raw: unknown): GeneratedQuizPayload {
  return GeneratedQuizSchema.parse(raw);
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const GeneratedQuestionV3Schema = z.custom<GeneratedQuestionV3>((value) => {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  try {
    return getAiQuestionContract(value.type as QuestionType).schema.safeParse(value).success;
  } catch {
    return false;
  }
}, { message: 'Câu hỏi không khớp hợp đồng AI V3.' });

export const GeneratedQuizV3Schema = z.object({
  promptVersion: z.literal('ai-blueprint-v3'),
  blueprintVersion: z.literal(3),
  title: NonEmptyText.max(500),
  detectedCategory: z.string().trim().min(1).max(100).optional(),
  detectedLesson: z.string().trim().min(1).max(500).optional(),
  suggestedTags: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  timeLimit: z.number().int().min(1).max(600).optional(),
  questions: z.array(GeneratedQuestionV3Schema).min(1).max(40),
}).superRefine((quiz, ctx) => {
  const slotIds = quiz.questions.map((question) => question.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['questions'],
      message: 'Mỗi câu hỏi phải có slotId duy nhất.',
    });
  }
});

export function parseGeneratedQuizV3(raw: unknown): GeneratedQuizV3 {
  const parsed = GeneratedQuizV3Schema.parse(raw);
  return {
    ...parsed,
    questions: parsed.questions.map((question) => (
      getAiQuestionContract(question.type).schema.parse(question) as GeneratedQuestionV3
    )),
  };
}
