import {
  QUIZ_ANSWER_SCHEMA_VERSION,
  QUIZ_SCORING_ENGINE_VERSION,
  buildQuizAnswerReview,
  gradeQuiz,
  isRawAnswerSkipped,
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
  questionCount: number;
  totalQuestions: number;
  voidedCount: number;
  details: QuestionGradingResult[];
  questions: Array<Record<string, unknown>>;
}

const QUESTION_COLUMNS = `
  id, type, question, question_rich_text, options, correct_answer, items, text_field, blanks,
  distractors, sentence, words, correct_word_indexes, image, svg_content, svg_alt, difficulty,
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
  const grading = gradeQuiz({ questions }, answers);
  return {
    gradingVersion: grading.engineVersion,
    answerSchemaVersion: grading.answerSchemaVersion,
    score: grading.score,
    correctCount: grading.correctCount,
    questionCount: grading.questionCount,
    totalQuestions: grading.totalQuestions,
    voidedCount: grading.voidedCount,
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
    'question_rich_text',
    'isCorrect',
    'categoryId',
  ]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key))
      .map(([key, nested]) => [key, stripCorrectFields(nested)]),
  );
};

export const MAX_RESULT_ANSWERS_WITH_RICH_BYTES = 1_500_000;

const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

const stripSnapshotRichText = (storedAnswers: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(storedAnswers).map(([questionId, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [questionId, entry];
    const envelope = entry as Record<string, unknown>;
    const snapshot = envelope.questionSnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [questionId, entry];
    const { questionRichText: _questionRichText, ...plainSnapshot } = snapshot as Record<string, unknown>;
    return [questionId, { ...envelope, questionSnapshot: plainSnapshot }];
  }));

export function buildAuthoritativeStoredAnswers(
  questions: readonly Record<string, unknown>[],
  submittedAnswers: unknown,
  details: readonly QuestionGradingResult[],
): Record<string, unknown> {
  const answerMap = submittedAnswers && typeof submittedAnswers === 'object' && !Array.isArray(submittedAnswers)
    ? submittedAnswers as Record<string, unknown>
    : {};
  const detailMap = new Map(details.map((detail) => [detail.questionId, detail]));

  const richCandidate = Object.fromEntries(questions.map((question) => {
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

  const containsRichSnapshot = Object.values(richCandidate).some((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const snapshot = (entry as Record<string, unknown>).questionSnapshot;
    return Boolean(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      && (snapshot as Record<string, unknown>).questionRichText !== undefined);
  });
  if (!containsRichSnapshot) return richCandidate;

  const candidateAnswersBytes = utf8ByteLength(JSON.stringify(richCandidate));
  if (candidateAnswersBytes <= MAX_RESULT_ANSWERS_WITH_RICH_BYTES) return richCandidate;

  const plainCandidate = stripSnapshotRichText(richCandidate);
  const plainAnswersBytes = utf8ByteLength(JSON.stringify(plainCandidate));
  console.info(JSON.stringify({
    event: 'result_rich_snapshot_budget_exceeded',
    questionCount: questions.length,
    candidateAnswersBytes,
    plainAnswersBytes,
    limitBytes: MAX_RESULT_ANSWERS_WITH_RICH_BYTES,
  }));
  return plainCandidate;
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
    const storedStatus = rawStatus === 'correct'
      || rawStatus === 'wrong'
      || rawStatus === 'skipped'
      || rawStatus === 'invalid'
      || rawStatus === 'voided'
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
