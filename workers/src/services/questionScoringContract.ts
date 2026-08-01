import {
  QUIZ_ANSWER_SCHEMA_VERSION,
  normalizeQuestionForGrading,
  type GradingIssue,
  type NormalizedGradableQuestion,
} from '../../../src/domain/quiz-scoring';

export class QuestionScoringContractValidationError extends Error {
  constructor(readonly issues: GradingIssue[]) {
    super('INVALID_QUESTION_SCORING_CONTRACT');
    this.name = 'QuestionScoringContractValidationError';
  }
}

export interface PreparedQuestionScoringContract {
  question: Record<string, unknown>;
  answerSchemaVersion: typeof QUIZ_ANSWER_SCHEMA_VERSION;
}

const canonicalFields = (
  normalized: NormalizedGradableQuestion,
): Record<string, unknown> => {
  switch (normalized.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return { correctAnswer: normalized.correctOptionId };
    case 'MULTIPLE_SELECT':
      return {
        correctAnswer: normalized.correctOptionIds,
        correctAnswers: normalized.correctOptionIds,
      };
    case 'DROPDOWN':
      return {
        blanks: normalized.blanks.map((blank) => ({
          id: blank.id,
          options: blank.options,
          correctAnswer: blank.correctAnswer,
        })),
      };
    case 'DRAG_DROP':
      return {
        blanks: normalized.blanks.map((blank) => ({
          id: blank.id,
          correctAnswer: blank.correctAnswer,
        })),
      };
    default:
      return {};
  }
};

export function prepareQuestionScoringContractForSave(
  input: unknown,
): PreparedQuestionScoringContract {
  const normalized = normalizeQuestionForGrading(input);
  if (normalized.ok === false) {
    throw new QuestionScoringContractValidationError(normalized.issues);
  }
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    question: {
      ...source,
      ...canonicalFields(normalized.question),
      answerSchemaVersion: QUIZ_ANSWER_SCHEMA_VERSION,
      answer_schema_version: QUIZ_ANSWER_SCHEMA_VERSION,
    },
    answerSchemaVersion: QUIZ_ANSWER_SCHEMA_VERSION,
  };
}
