export const AI_QUESTION_QUALITY_VERSION = 'ai-question-quality-v1' as const;

export type AiQuestionQualitySeverity = 'blocking' | 'warning';

export type AiQuestionQualityCode =
  | 'EMPTY_STEM'
  | 'ANSWER_OUTSIDE_OPTIONS'
  | 'DUPLICATE_OPTION'
  | 'DUPLICATE_QUESTION'
  | 'GRADE_MISMATCH'
  | 'MATH_PARSE_RISK';

export interface AiQuestionQualityIssue {
  id: string;
  code: AiQuestionQualityCode;
  severity: AiQuestionQualitySeverity;
  questionIndex: number;
  questionId?: string;
  message: string;
  path?: string;
}

export interface AiQuestionQualitySummary {
  version: typeof AI_QUESTION_QUALITY_VERSION;
  checkedAt: string;
  questionCount: number;
  blockingCount: number;
  warningCount: number;
  canPublish: boolean;
  issues: AiQuestionQualityIssue[];
}

export interface AiQuestionQualityInput {
  classLevel: string;
  questions: unknown[];
  checkedAt?: string;
}

export interface AiQuestionQualityPersistedSummary {
  version: typeof AI_QUESTION_QUALITY_VERSION;
  checkedAt: string;
  blockingCount: number;
  warningCount: number;
  acknowledgedWarningIds: string[];
}
