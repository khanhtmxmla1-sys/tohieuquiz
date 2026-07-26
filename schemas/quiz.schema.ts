import { z } from 'zod';

// ===============================
// Question Type Enum
// ===============================
export const QuestionTypeSchema = z.enum([
    'MCQ',
    'TRUE_FALSE',
    'SHORT_ANSWER',
    'MATCHING',
    'MULTIPLE_SELECT',
    'DRAG_DROP',
    'ORDERING',
    'IMAGE_QUESTION',
    'DROPDOWN',
    'UNDERLINE',
    'CATEGORIZATION',
    'WORD_SCRAMBLE',
    'RIDDLE',
    'ERROR_CORRECTION',
]);

const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const NonEmptyText = z.string().trim().min(1, 'Nội dung không được để trống.');

// ===============================
// Base Question Schema
// ===============================
const BaseQuestionSchema = z.object({
    id: z.string().trim().min(1, 'Câu hỏi phải có ID.'),
    image: z.string().trim().min(1).optional(),
    imageAlt: z.string().trim().min(1).optional(),
    explanation: z.string().optional(),
    difficulty: DifficultySchema.optional(),
    subject: z.string().trim().min(1).optional(),
    skillCode: z.string().trim().min(1).optional(),
    subskillCode: z.string().trim().min(1).optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    points: z.number().nonnegative().optional(),
});

const AnswerLetter = z.string().regex(/^[A-F]$/, 'Đáp án phải là một chữ cái từ A đến F.');

// ===============================
// MCQ Question
// ===============================
export const MCQQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('MCQ'),
    question: NonEmptyText,
    options: z.array(NonEmptyText).min(2, 'Cần ít nhất 2 phương án.').max(6),
    correctAnswer: AnswerLetter,
});

// ===============================
// Multiple Select Question
// ===============================
export const MultipleSelectQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('MULTIPLE_SELECT'),
    question: NonEmptyText,
    options: z.array(NonEmptyText).min(2).max(6),
    correctAnswers: z.array(AnswerLetter).min(1),
});

// ===============================
// True/False Question
// ===============================
export const TrueFalseItemSchema = z.object({
    id: z.string().trim().min(1),
    statement: NonEmptyText,
    isCorrect: z.boolean(),
});

export const TrueFalseQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('TRUE_FALSE'),
    mainQuestion: NonEmptyText,
    items: z.array(TrueFalseItemSchema).min(1).max(10),
});

// ===============================
// Short Answer Question
// ===============================
export const ShortAnswerQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('SHORT_ANSWER'),
    question: NonEmptyText,
    correctAnswer: NonEmptyText,
});

// ===============================
// Matching Question
// ===============================
export const MatchingPairSchema = z.object({
    left: NonEmptyText,
    right: NonEmptyText,
    image: z.string().trim().min(1).optional(),
});

export const MatchingQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('MATCHING'),
    question: NonEmptyText,
    pairs: z.array(MatchingPairSchema).min(2).max(10),
});

// ===============================
// Drag & Drop Question
// ===============================
export const DragDropQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('DRAG_DROP'),
    question: NonEmptyText,
    text: NonEmptyText,
    blanks: z.array(NonEmptyText).min(1),
    distractors: z.array(NonEmptyText).default([]),
});

// ===============================
// Ordering Question
// ===============================
export const OrderingQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('ORDERING'),
    question: NonEmptyText,
    items: z.array(NonEmptyText).min(2),
    correctOrder: z.array(z.number().int().nonnegative()),
});

// ===============================
// Image Question
// ===============================
export const ImageQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('IMAGE_QUESTION'),
    question: NonEmptyText,
    image: NonEmptyText,
    imageAlt: NonEmptyText.optional(),
    options: z.array(NonEmptyText).min(2).max(6),
    optionImages: z.array(NonEmptyText).max(6).optional(),
    correctAnswer: AnswerLetter,
});

// ===============================
// Dropdown Question
// ===============================
export const DropdownBlankSchema = z.object({
    id: z.string().trim().min(1),
    options: z.array(NonEmptyText).min(2),
    correctAnswer: NonEmptyText,
});

export const DropdownQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('DROPDOWN'),
    question: NonEmptyText,
    text: NonEmptyText,
    blanks: z.array(DropdownBlankSchema).min(1),
});

// ===============================
// Underline Question
// ===============================
export const UnderlineQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('UNDERLINE'),
    question: NonEmptyText,
    sentence: NonEmptyText,
    words: z.array(NonEmptyText).min(1),
    correctWordIndexes: z.array(z.number().int().nonnegative()).min(1),
});

// ===============================
// Categorization Question
// ===============================
export const CategorizationQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('CATEGORIZATION'),
    question: NonEmptyText,
    instruction: z.string().trim().min(1).optional(),
    categories: z.array(z.object({
        id: z.string().trim().min(1),
        name: NonEmptyText,
    })).min(2),
    items: z.array(z.object({
        id: z.string().trim().min(1),
        content: NonEmptyText,
        categoryId: z.string().trim().min(1),
    })).min(1),
});

// ===============================
// Word Scramble Question
// ===============================
export const WordScrambleQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('WORD_SCRAMBLE'),
    question: NonEmptyText,
    letters: z.array(NonEmptyText).min(2),
    correctWord: NonEmptyText,
    hint: z.string().trim().min(1).optional(),
});

// ===============================
// Riddle Question
// ===============================
export const RiddleQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('RIDDLE'),
    question: NonEmptyText,
    riddleLines: z.array(NonEmptyText).min(1),
    correctAnswer: NonEmptyText,
    answerType: z.enum(['original', 'transformed']),
    answerLabel: NonEmptyText,
    hint: z.string().trim().min(1).optional(),
});

// ===============================
// Manual-only Error Correction Question
// ===============================
export const ErrorCorrectionQuestionSchema = BaseQuestionSchema.extend({
    type: z.literal('ERROR_CORRECTION'),
    question: NonEmptyText,
    passage: NonEmptyText,
    wrongWord: NonEmptyText,
    correctWord: NonEmptyText,
});

// GEOMETRY intentionally remains outside this rollout.
export const QuestionSchema = z.discriminatedUnion('type', [
    MCQQuestionSchema,
    MultipleSelectQuestionSchema,
    TrueFalseQuestionSchema,
    ShortAnswerQuestionSchema,
    MatchingQuestionSchema,
    DragDropQuestionSchema,
    OrderingQuestionSchema,
    ImageQuestionSchema,
    DropdownQuestionSchema,
    UnderlineQuestionSchema,
    CategorizationQuestionSchema,
    WordScrambleQuestionSchema,
    RiddleQuestionSchema,
    ErrorCorrectionQuestionSchema,
]);

// ===============================
// Quiz Schema
// ===============================
export const QuizSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1, 'Tiêu đề không được để trống.').max(200),
    classLevel: z.string().regex(/^[1-5]$/, 'Khối lớp phải từ 1 đến 5.'),
    timeLimit: z.number().min(1).max(180),
    questions: z.array(QuestionSchema).min(1, 'Đề phải có ít nhất một câu hỏi.'),
    createdAt: z.string().datetime(),
    accessCode: z.string().length(6).optional(),
    requireCode: z.boolean().optional(),
});

// ===============================
// Student Result Schema
// ===============================
export const StudentResultSchema = z.object({
    id: z.string().uuid(),
    quizId: z.string().min(1),
    quizTitle: z.string().optional(),
    studentName: z.string().min(1, 'Tên học sinh không được để trống.').max(100),
    studentClass: z.string().min(1, 'Lớp học không được để trống.').max(20),
    score: z.number().min(0).max(10),
    correctCount: z.number().min(0),
    totalQuestions: z.number().min(1),
    timeTaken: z.number().min(0),
    submittedAt: z.string().datetime(),
    answers: z.record(z.string(), z.any()),
});

export type QuizInput = z.infer<typeof QuizSchema>;
export type QuestionInput = z.infer<typeof QuestionSchema>;
export type StudentResultInput = z.infer<typeof StudentResultSchema>;

export const validateQuiz = (data: unknown) => QuizSchema.safeParse(data);
export const validateQuestion = (data: unknown) => QuestionSchema.safeParse(data);
export const validateStudentResult = (data: unknown) => StudentResultSchema.safeParse(data);
