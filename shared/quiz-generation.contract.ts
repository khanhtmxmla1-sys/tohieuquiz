import { z } from 'zod';
import { QUIZ_AI_SOURCES } from './teacher-ai-credentials.contract';

export const AI_SELECTABLE_QUIZ_QUESTION_TYPES = [
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
] as const;

export type AiSelectableQuizQuestionType = typeof AI_SELECTABLE_QUIZ_QUESTION_TYPES[number];
export type ServerQuizAiSource = typeof QUIZ_AI_SOURCES[number];
export type ServerQuizIntent = 'EXAM' | 'PRACTICE';
export type ServerQuizRequestSourceMode = 'TOPIC' | 'DOCUMENT_TEXT';
export type ServerQuizBlueprintSourceMode = 'TOPIC' | 'DOCUMENT';
export type ServerQuizDiagramMode = 'off' | 'auto';
export type ServerQuizLearnerMode = 'default' | 'gifted' | 'remedial';
export type ServerQuizDifficulty = 1 | 2 | 3;
export type ServerQuizImagePolicy = 'forbidden' | 'optional' | 'required';
export type ServerQuizDiagramPolicy = 'forbidden' | 'optional' | 'required';

const utf8ByteLength = (value: string): number => (
  new TextEncoder().encode(value).byteLength
);

const QuizQuestionTypeSchema = z.enum(AI_SELECTABLE_QUIZ_QUESTION_TYPES);

const TypeAllocationSchema = z.object({
  type: QuizQuestionTypeSchema,
  count: z.number().int().min(0).max(40),
}).strict();

const DifficultyLevelsSchema = z.object({
  level1: z.number().int().min(0).max(40),
  level2: z.number().int().min(0).max(40),
  level3: z.number().int().min(0).max(40),
}).strict();

const PromptProfileSchema = z.object({
  useThongTu27: z.boolean(),
  learnerMode: z.enum(['default', 'gifted', 'remedial']),
}).strict();

export const ServerQuizGenerationRequestSchema = z.object({
  actionId: z.string().trim().min(1).max(160),
  source: z.enum(QUIZ_AI_SOURCES).optional(),
  title: z.string().trim().min(1).max(300),
  topic: z.string().trim().min(1).max(300),
  classLevel: z.string().trim().min(1).max(32),
  content: z.string()
    .max(256 * 1024)
    .refine((value) => utf8ByteLength(value) <= 256 * 1024, {
      message: 'Nội dung nguồn vượt quá giới hạn 256 KiB UTF-8.',
    })
    .optional()
    .default(''),
  intent: z.enum(['EXAM', 'PRACTICE']),
  sourceMode: z.enum(['TOPIC', 'DOCUMENT_TEXT']),
  questionCount: z.number().int().min(1).max(40),
  typeAllocations: z.array(TypeAllocationSchema).min(1).max(AI_SELECTABLE_QUIZ_QUESTION_TYPES.length),
  difficultyLevels: DifficultyLevelsSchema,
  promptProfile: PromptProfileSchema,
  customPrompt: z.string()
    .trim()
    .max(4096)
    .refine((value) => utf8ByteLength(value) <= 4096, {
      message: 'Yêu cầu riêng vượt quá giới hạn 4 KiB UTF-8.',
    })
    .optional(),
  subject: z.string().trim().min(1).max(64).optional(),
  skillCode: z.string().trim().min(1).max(128).optional(),
  subskillCode: z.string().trim().min(1).max(128).optional(),
  sourceRefs: z.array(z.string().trim().min(1).max(256)).max(50).optional(),
  diagramMode: z.enum(['off', 'auto']).optional().default('off'),
}).strict().superRefine((value, context) => {
  const allocationTypes = value.typeAllocations.map(({ type }) => type);
  if (new Set(allocationTypes).size !== allocationTypes.length) {
    context.addIssue({
      code: 'custom',
      path: ['typeAllocations'],
      message: 'Mỗi dạng câu chỉ được xuất hiện một lần.',
    });
  }

  const typeTotal = value.typeAllocations.reduce((sum, allocation) => sum + allocation.count, 0);
  if (typeTotal !== value.questionCount) {
    context.addIssue({
      code: 'custom',
      path: ['typeAllocations'],
      message: `Tổng số câu theo dạng phải bằng ${value.questionCount}.`,
    });
  }

  const difficultyTotal = (
    value.difficultyLevels.level1
    + value.difficultyLevels.level2
    + value.difficultyLevels.level3
  );
  if (difficultyTotal !== value.questionCount) {
    context.addIssue({
      code: 'custom',
      path: ['difficultyLevels'],
      message: `Tổng số câu theo độ khó phải bằng ${value.questionCount}.`,
    });
  }

  if (value.sourceMode === 'DOCUMENT_TEXT' && !value.content.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['content'],
      message: 'sourceMode DOCUMENT_TEXT phải có nội dung nguồn.',
    });
  }

  if (
    (value.source === 'gemini-personal' || value.source === 'deepseek-personal')
    && value.typeAllocations.some(({ type }) => type === 'IMAGE_QUESTION')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['typeAllocations'],
      message: 'Nguồn AI cá nhân V1 không hỗ trợ dạng câu cần ảnh.',
    });
  }
});

export type ServerQuizGenerationRequest = z.infer<typeof ServerQuizGenerationRequestSchema>;
export type ServerQuizPromptProfile = z.infer<typeof PromptProfileSchema>;

export interface ServerQuizBlueprintSlot {
  slotId: `slot-${number}`;
  ordinal: number;
  type: AiSelectableQuizQuestionType;
  difficulty: ServerQuizDifficulty;
  objective: string;
  subject?: string;
  skillCode?: string;
  subskillCode?: string;
  imagePolicy: ServerQuizImagePolicy;
  diagramPolicy: ServerQuizDiagramPolicy;
  sourceRefs?: string[];
}

export interface ServerQuizBlueprintV3 {
  version: 3;
  intent: ServerQuizIntent;
  sourceMode: ServerQuizBlueprintSourceMode;
  topic: string;
  classLevel: string;
  totalQuestions: number;
  slots: ServerQuizBlueprintSlot[];
}

export interface ServerGeneratedQuestionV3 extends Record<string, unknown> {
  slotId: string;
  type: AiSelectableQuizQuestionType;
  difficulty: ServerQuizDifficulty;
  diagramPolicy: ServerQuizDiagramPolicy;
}

export interface ServerGeneratedQuizV3 {
  promptVersion: 'ai-blueprint-v3';
  blueprintVersion: 3;
  title: string;
  detectedCategory?: string;
  detectedLesson?: string;
  suggestedTags?: string[];
  questions: ServerGeneratedQuestionV3[];
}

export interface ServerQuizGenerationResponse {
  status: 'success';
  actionId: string;
  source: ServerQuizAiSource;
  promptVersion: 'ai-blueprint-v3';
  blueprintVersion: 3;
  orchestratorVersion: 'server-quiz-v1';
  quiz: ServerGeneratedQuizV3;
}

export type ServerQuizGenerationErrorCode =
  | 'QUIZ_REQUEST_INVALID'
  | 'QUIZ_SOURCE_UNAVAILABLE'
  | 'QUIZ_CAPABILITY_UNSUPPORTED'
  | 'AI_DAILY_LIMIT_REACHED'
  | 'AI_ACTION_CONFLICT'
  | 'AI_KEY_MISSING'
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_ACCOUNT_REQUIRED'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_RESPONSE_INVALID'
  | 'QUIZ_GENERATION_INVALID'
  | 'QUIZ_GENERATION_TIMEOUT'
  | 'QUIZ_POLICY_UNAVAILABLE';
