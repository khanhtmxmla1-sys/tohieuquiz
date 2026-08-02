import {
  QUIZ_ANSWER_SCHEMA_VERSION,
  QUIZ_SCORING_ENGINE_VERSION,
  buildQuizAnswerReview,
  gradeQuiz,
  isRawAnswerSkipped,
  normalizeQuestionForGrading,
  unwrapStoredResultAnswer,
  type QuestionAnswerReview,
  type QuestionGradingResult,
} from '../../../src/domain/quiz-scoring';
import { mapLiveExamQuestionRow } from './liveExamQuestionMapper';

export class QuizGradingServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'QuizGradingServiceError';
  }
}

export interface AuthoritativeQuizGrading {
  gradingVersion: typeof QUIZ_SCORING_ENGINE_VERSION;
  answerSchemaVersion: typeof QUIZ_ANSWER_SCHEMA_VERSION;
  score: number;
  correctCount: number;
  totalQuestions: number;
  details: QuestionGradingResult[];
  questions: Array<Record<string, unknown>>;
}

const QUESTION_COLUMNS = `
  id, type, question, options, correct_answer, items, text_field, blanks,
  distractors, sentence, words, correct_word_indexes, image, difficulty,
  answer_schema_version
`;

export async function loadQuizQuestionsForGrading(
  db: D1Database,
  quizId: string,
): Promise<Array<Record<string, unknown>>> {
  const normalizedQuizId = String(quizId || '').trim();
  if (!normalizedQuizId) {
    throw new QuizGradingServiceError('Quiz ID is required', 400, 'QUIZ_ID_REQUIRED');
  }

  const rows = await db.prepare(`
    SELECT ${QUESTION_COLUMNS}
    FROM questions
    WHERE quiz_id = ?
    ORDER BY rowid ASC
  `).bind(normalizedQuizId).all<Record<string, unknown>>();

  const questions = (rows.results || []).map((row) => mapLiveExamQuestionRow(row) as unknown as Record<string, unknown>);
  if (questions.length === 0) {
    throw new QuizGradingServiceError(
      `No questions found for quiz: ${normalizedQuizId}`,
      404,
      'QUIZ_QUESTIONS_NOT_FOUND',
    );
  }
  return questions;
}

export async function gradeQuizSubmission(
  db: D1Database,
  quizId: string,
  answers: unknown,
): Promise<AuthoritativeQuizGrading> {
  const questions = await loadQuizQuestionsForGrading(db, quizId);
  const questionIssues = questions.flatMap((question) => {
    const normalized = normalizeQuestionForGrading(question);
    return normalized.ok === false ? normalized.issues : [];
  });
  if (questionIssues.length > 0) {
    throw new QuizGradingServiceError(
      'Quiz contains questions that cannot be graded safely',
      422,
      'INVALID_QUESTION_CONTRACT',
      questionIssues,
    );
  }

  const grading = gradeQuiz({ questions }, answers);
  return {
    gradingVersion: grading.engineVersion,
    answerSchemaVersion: grading.answerSchemaVersion,
    score: grading.score,
    correctCount: grading.correctCount,
    totalQuestions: grading.totalQuestions,
    details: grading.details,
    questions,
  };
}

const stripCorrectFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripCorrectFields);
  if (!value || typeof value !== 'object') return value;

  const blocked = new Set([
    'correctAnswer',
    'correctAnswers',
    'correctOrder',
    'correctWordIndexes',
    'correctWord',
    'correct_answer',
    'correct_word_indexes',
    'isCorrect',
    'categoryId',
  ]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key))
      .map(([key, nested]) => [key, stripCorrectFields(nested)]),
  );
};

export function buildAuthoritativeStoredAnswers(
  questions: readonly Record<string, unknown>[],
  submittedAnswers: unknown,
  details: readonly QuestionGradingResult[],
): Record<string, unknown> {
  const answerMap = submittedAnswers && typeof submittedAnswers === 'object' && !Array.isArray(submittedAnswers)
    ? submittedAnswers as Record<string, unknown>
    : {};
  const detailMap = new Map(details.map((detail) => [detail.questionId, detail]));

  return Object.fromEntries(questions.map((question) => {
    const questionId = String(question.id ?? '');
    const detail = detailMap.get(questionId);
    return [questionId, {
      selectedAnswer: unwrapStoredResultAnswer(answerMap[questionId]),
      isCorrect: detail?.isCorrect === true,
      status: detail?.status ?? 'invalid',
      questionSnapshot: stripCorrectFields(question),
      gradingVersion: QUIZ_SCORING_ENGINE_VERSION,
    }];
  }));
}

export function buildAuthoritativeReviewDetails(
  questions: readonly Record<string, unknown>[],
  submittedAnswers: unknown,
  details: readonly QuestionGradingResult[],
): QuestionAnswerReview[] {
  return buildQuizAnswerReview(questions, submittedAnswers, details);
}

export function buildStoredResultReviewDetails(
  questions: readonly Record<string, unknown>[],
  storedAnswers: unknown,
): QuestionAnswerReview[] {
  const answerMap = storedAnswers && typeof storedAnswers === 'object' && !Array.isArray(storedAnswers)
    ? storedAnswers as Record<string, unknown>
    : {};
  const details: QuestionGradingResult[] = questions.map((question) => {
    const questionId = String(question.id ?? '');
    const stored = answerMap[questionId];
    const envelope = stored && typeof stored === 'object' && !Array.isArray(stored)
      ? stored as Record<string, unknown>
      : {};
    const selectedAnswer = unwrapStoredResultAnswer(stored);
    const rawStatus = String(envelope.status ?? '');
    const storedStatus = rawStatus === 'correct' || rawStatus === 'wrong' || rawStatus === 'skipped' || rawStatus === 'invalid'
      ? rawStatus
      : null;
    const status = storedStatus
      ?? (isRawAnswerSkipped(selectedAnswer)
        ? 'skipped'
        : envelope.isCorrect === true
          ? 'correct'
          : envelope.isCorrect === false
            ? 'wrong'
            : 'invalid');
    return {
      questionId,
      type: String(question.type ?? ''),
      status,
      isCorrect: envelope.isCorrect === true,
      normalizedStudentAnswer: selectedAnswer,
    };
  });
  return buildQuizAnswerReview(questions, answerMap, details);
}
