export const QUIZ_SCORING_ENGINE_VERSION = '2.0.0' as const;
export const QUIZ_ANSWER_SCHEMA_VERSION = 2 as const;

export type PublishedQuestionType =
  | 'MCQ'
  | 'IMAGE_QUESTION'
  | 'MULTIPLE_SELECT'
  | 'SHORT_ANSWER'
  | 'TRUE_FALSE'
  | 'MATCHING'
  | 'DRAG_DROP'
  | 'DROPDOWN'
  | 'ORDERING'
  | 'CATEGORIZATION'
  | 'UNDERLINE'
  | 'WORD_SCRAMBLE'
  | 'RIDDLE'
  | 'ERROR_CORRECTION';

export type QuizAnswer =
  | { type: 'MCQ' | 'IMAGE_QUESTION'; optionId: string }
  | { type: 'MULTIPLE_SELECT'; optionIds: string[] }
  | { type: 'SHORT_ANSWER' | 'RIDDLE'; value: string }
  | { type: 'TRUE_FALSE'; values: Record<string, boolean> }
  | { type: 'MATCHING'; pairs: Record<string, string> }
  | { type: 'DROPDOWN' | 'DRAG_DROP'; values: Record<string, string> }
  | { type: 'ORDERING'; ranks: Record<string, number> }
  | { type: 'UNDERLINE'; indexes: number[] }
  | { type: 'CATEGORIZATION'; categoriesByItemId: Record<string, string> }
  | { type: 'WORD_SCRAMBLE'; letterIndexes: number[] }
  | { type: 'ERROR_CORRECTION'; wrongWord: string; correctWord: string };

export interface NormalizedOption {
  id: string;
  index: number;
  text: string;
}

export interface NormalizedPair {
  leftId: string;
  rightId: string;
  leftText: string;
  rightText: string;
}

export interface NormalizedBlank {
  id: string;
  index: number;
  rawToken?: string;
  correctAnswer: string;
  options: string[];
}

export interface NormalizedOrderingItem {
  id: string;
  index: number;
  text: string;
}

interface NormalizedQuestionBase {
  id: string;
  type: PublishedQuestionType;
  originalType: string;
}

export type NormalizedGradableQuestion =
  | (NormalizedQuestionBase & {
      type: 'MCQ' | 'IMAGE_QUESTION';
      options: NormalizedOption[];
      correctOptionId: string;
    })
  | (NormalizedQuestionBase & {
      type: 'MULTIPLE_SELECT';
      options: NormalizedOption[];
      correctOptionIds: string[];
    })
  | (NormalizedQuestionBase & {
      type: 'SHORT_ANSWER' | 'RIDDLE';
      acceptedValues: string[];
    })
  | (NormalizedQuestionBase & {
      type: 'TRUE_FALSE';
      correctValues: Record<string, boolean>;
    })
  | (NormalizedQuestionBase & {
      type: 'MATCHING';
      pairs: NormalizedPair[];
      correctPairs: Record<string, string>;
      duplicateLeftText: boolean;
      duplicateRightText: boolean;
    })
  | (NormalizedQuestionBase & {
      type: 'DROPDOWN' | 'DRAG_DROP';
      blanks: NormalizedBlank[];
      correctValues: Record<string, string>;
    })
  | (NormalizedQuestionBase & {
      type: 'ORDERING';
      items: NormalizedOrderingItem[];
      correctRanks: Record<string, number>;
    })
  | (NormalizedQuestionBase & {
      type: 'CATEGORIZATION';
      correctCategories: Record<string, string>;
      categoryIds: string[];
    })
  | (NormalizedQuestionBase & {
      type: 'UNDERLINE';
      correctIndexes: number[];
      wordCount: number;
    })
  | (NormalizedQuestionBase & {
      type: 'WORD_SCRAMBLE';
      letters: string[];
      correctWord: string;
    })
  | (NormalizedQuestionBase & {
      type: 'ERROR_CORRECTION';
      wrongWord: string;
      correctWord: string;
    });

export interface GradingIssue {
  questionId: string;
  code: string;
  message: string;
}

export type NormalizedQuestionResult =
  | { ok: true; question: NormalizedGradableQuestion }
  | { ok: false; questionId: string; type: string; issues: GradingIssue[] };

export type NormalizedAnswerResult =
  | { ok: true; answer: QuizAnswer }
  | { ok: false; issueCode: string; message: string };

export type GradingStatus = 'correct' | 'wrong' | 'skipped' | 'invalid' | 'voided';

export interface QuestionGradingResult {
  questionId: string;
  type: string;
  status: GradingStatus;
  isCorrect: boolean;
  normalizedStudentAnswer: unknown;
  issueCode?: string;
}

export interface QuizGradingResult {
  engineVersion: typeof QUIZ_SCORING_ENGINE_VERSION;
  answerSchemaVersion: typeof QUIZ_ANSWER_SCHEMA_VERSION;
  score: number;
  correctCount: number;
  questionCount: number;
  totalQuestions: number;
  voidedCount: number;
  details: QuestionGradingResult[];
  issues: GradingIssue[];
}

export interface QuizLike {
  questions: readonly unknown[];
}
