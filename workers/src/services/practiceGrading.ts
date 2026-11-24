import {
  PRACTICE_DELIVERY_VERSION,
  isPlainRecord,
  type PracticeGradeResponse,
  type PracticeSessionClaims,
  type PracticeSessionQuestionReference,
} from '../../../shared/practice-grading.contract';
import {
  buildAuthoritativeReviewDetails,
  buildAuthoritativeStoredAnswers,
} from './quizGradingService';
import {
  decodeStudentAnswersForGrading,
} from './studentQuizQuestionDto';
import {
  derivePracticeDtoContext,
  fingerprintPracticeQuestionRow,
  verifyPracticeSession,
} from './practiceSession';
import { mapLiveExamQuestionRow } from './liveExamQuestionMapper';
import { PUBLIC_PRACTICE_SOURCE_SCOPE_SQL } from './practiceQuestionScope';
import {
  PracticePresentationError,
  rebasePracticeAnswerForGrading,
  validatePracticeStructuredAnswer,
} from './practicePresentation';
import { gradeQuiz } from '../../../src/domain/quiz-scoring';

/**
 * Keep this projection identical for session issuance and grade-time refresh.
 * Fingerprints cover the full answer-bearing row selected here, while the
 * response path projects it through the practice student DTO.
 */
export const PRACTICE_QUESTION_PROJECTION = `
  q.id,
  q.quiz_id,
  q.type,
  q.question,
  q.question_rich_text,
  q.options,
  q.correct_answer,
  q.items,
  q.text_field,
  q.blanks,
  q.distractors,
  q.sentence,
  q.words,
  q.correct_word_indexes,
  q.image,
  q.image_alt,
  q.svg_content,
  q.svg_alt,
  q.tags,
  q.difficulty,
  q.answer_schema_version,
  public_quiz.revision AS quiz_revision`;

const QUESTION_TYPE_ALIASES: Record<string, string> = {
  MULTIPLE_CHOICE: 'MCQ',
  IMAGE: 'IMAGE_QUESTION',
  IMAGE_MCQ: 'IMAGE_QUESTION',
  MATH_INPUT: 'SHORT_ANSWER',
  FILL_IN_THE_BLANK: 'DROPDOWN',
};

const canonicalizeQuestionRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const rawType = String(row.type ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const canonicalType = QUESTION_TYPE_ALIASES[rawType] ?? rawType;
  return { ...row, type: canonicalType };
};

export class PracticeGradingError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PracticeGradingError';
  }
}

interface PracticeDb {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

export interface PracticeGradeInput {
  db: PracticeDb;
  jwtSecret: string;
  sessionToken: string;
  answers: Record<string, unknown>;
  questionOrder?: string[];
  now?: Date | number;
}

export interface PracticeSelectionInput {
  db: PracticeDb;
  topic: string;
  limit: number;
  randomize: boolean;
}

const selectionOrder = (randomize: boolean): string => randomize ? 'RANDOM()' : 'q.rowid ASC';

export async function loadPracticeSelection(input: PracticeSelectionInput): Promise<Record<string, unknown>[]> {
  const rows = await input.db.prepare(`
    SELECT ${PRACTICE_QUESTION_PROJECTION}
    ${PUBLIC_PRACTICE_SOURCE_SCOPE_SQL}
      AND INSTR(
        ',' || REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(q.tags, ''), ' ', ','), char(9), ','), char(10), ','), char(13), ',') || ',',
        ',' || ? || ','
      ) > 0
    ORDER BY ${selectionOrder(input.randomize)}
    LIMIT ?
  `).bind(input.topic, input.limit).all<Record<string, unknown>>();
  return rows.results;
}

async function loadSelectedRows(
  db: PracticeDb,
  selected: readonly PracticeSessionQuestionReference[],
): Promise<Record<string, unknown>[]> {
  const ids = selected.map((reference) => reference.questionId);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.prepare(`
    SELECT ${PRACTICE_QUESTION_PROJECTION}
    ${PUBLIC_PRACTICE_SOURCE_SCOPE_SQL}
      AND q.id IN (${placeholders})
  `).bind(...ids).all<Record<string, unknown>>();
  const byId = new Map(rows.results.map((row) => [String(row.id ?? ''), row]));
  return ids.map((id) => byId.get(id)).filter((row): row is Record<string, unknown> => Boolean(row));
}

const unwrapAnswer = (value: unknown): unknown => {
  if (isPlainRecord(value) && Object.prototype.hasOwnProperty.call(value, 'selectedAnswer')) {
    return value.selectedAnswer;
  }
  return value;
};

const hasMeaningfulAnswer = (value: unknown, seen = new Set<object>()): boolean => {
  const answer = unwrapAnswer(value);
  if (answer !== value) return hasMeaningfulAnswer(answer, seen);
  if (answer === undefined || answer === null) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (typeof answer !== 'object') return true;
  if (seen.has(answer)) return false;
  seen.add(answer);
  try {
    if (Array.isArray(answer)) return answer.some((item) => hasMeaningfulAnswer(item, seen));
    const record = answer as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => !['type', 'selectedLeft', '__shuffledIds'].includes(key));
    return keys.some((key) => hasMeaningfulAnswer(record[key], seen));
  } finally {
    seen.delete(answer);
  }
};

const validateQuestionOrder = (
  questionOrder: string[] | undefined,
  selected: readonly PracticeSessionQuestionReference[],
): string[] => {
  const expected = selected.map((reference) => reference.questionId);
  if (questionOrder === undefined) return expected;
  if (questionOrder.length !== expected.length) {
    throw new PracticeGradingError('PRACTICE_QUESTION_ORDER_INVALID', 'Question order must contain every selected question exactly once.');
  }
  const expectedSet = new Set(expected);
  if (new Set(questionOrder).size !== questionOrder.length || questionOrder.some((id) => !expectedSet.has(id))) {
    throw new PracticeGradingError('PRACTICE_QUESTION_ORDER_INVALID', 'Question order must contain every selected question exactly once.');
  }
  return questionOrder;
};

const verifySelectedRows = async (
  rows: readonly Record<string, unknown>[],
  selected: readonly PracticeSessionQuestionReference[],
  jwtSecret: string,
): Promise<void> => {
  if (rows.length !== selected.length) {
    throw new PracticeGradingError('PRACTICE_SESSION_STALE', 'Practice questions are no longer available. Please refresh.', 409);
  }
  const byId = new Map(rows.map((row) => [String(row.id ?? ''), row]));
  for (const reference of selected) {
    const row = byId.get(reference.questionId);
    if (!row || String(row.quiz_id ?? '') !== reference.quizId
      || Number(row.quiz_revision ?? 1) !== reference.revision) {
      throw new PracticeGradingError('PRACTICE_SESSION_STALE', 'Practice questions changed. Please refresh.', 409);
    }
    const fingerprint = await fingerprintPracticeQuestionRow(row, jwtSecret);
    if (fingerprint !== reference.fingerprint) {
      throw new PracticeGradingError('PRACTICE_SESSION_STALE', 'Practice questions changed. Please refresh.', 409);
    }
  }
};

const normalizeRows = (rows: readonly Record<string, unknown>[]): any[] => rows.map((row) => (
  mapPracticeSourceRow(row)
));

export const mapPracticeSourceRow = (row: Record<string, unknown>): any => {
  const mapped = mapLiveExamQuestionRow(canonicalizeQuestionRow(row)) as any;
  // Legacy underline rows may only have a sentence plus valid answer indexes.
  // Restore the old token fallback in the practice layer before normalization;
  // formal/live DTO compatibility remains unchanged.
  if (String(mapped.type).toUpperCase() === 'UNDERLINE'
    && (!Array.isArray(mapped.words) || mapped.words.length === 0)) {
    const sentence = String(mapped.sentence ?? mapped.text ?? mapped.question ?? '');
    const words = sentence.split(/\s+/u).filter(Boolean);
    if (words.length > 0) mapped.words = words;
  }
  return mapped;
};

const errorFromPresentation = (error: unknown): PracticeGradingError => {
  if (error instanceof PracticePresentationError) {
    return new PracticeGradingError(error.code, 'Practice answer is invalid.', 400);
  }
  return new PracticeGradingError('PRACTICE_ANSWER_INVALID', 'Practice answer is invalid.', 400);
};

export async function gradePracticeSubmission(input: PracticeGradeInput): Promise<PracticeGradeResponse> {
  const claims = await verifyPracticeSession(input.sessionToken, {
    jwtSecret: input.jwtSecret,
    now: input.now,
  });
  if (!claims) {
    // This is a practice-session conflict, not an authenticated-user login
    // failure. Keep it out of generic 401 handling so guests retain drafts.
    throw new PracticeGradingError('PRACTICE_SESSION_INVALID', 'Practice session is invalid or expired.', 409);
  }
  const selected = claims.selected;
  const questionOrder = validateQuestionOrder(input.questionOrder, selected);
  if (!isPlainRecord(input.answers)) {
    throw new PracticeGradingError('PRACTICE_ANSWERS_INVALID', 'Practice answers must be an object.');
  }
  const selectedIds = new Set(selected.map((reference) => reference.questionId));
  for (const questionId of Object.keys(input.answers)) {
    if (!selectedIds.has(questionId)) {
      throw new PracticeGradingError('PRACTICE_ANSWER_QUESTION_INVALID', 'Answer references an unknown question.');
    }
  }

  const sourceRows = await loadSelectedRows(input.db, selected);
  await verifySelectedRows(sourceRows, selected, input.jwtSecret);
  const questions = normalizeRows(sourceRows);
  const questionById = new Map(questions.map((question) => [String(question.id), question]));
  if (questionById.size !== selected.length) {
    throw new PracticeGradingError('PRACTICE_SESSION_STALE', 'Practice questions changed. Please refresh.', 409);
  }

  // Keep an explicit null for every selected question. This makes skipped
  // submissions complete and unambiguous in the authoritative response while
  // still treating null/empty structured selections as absent for decoding.
  const canonicalAnswers: Record<string, unknown> = Object.fromEntries(
    selected.map((reference) => [reference.questionId, null]),
  );
  const questionsByScope = new Map<string, { questions: any[]; answers: Record<string, unknown>; context: Awaited<ReturnType<typeof derivePracticeDtoContext>> }>();
  for (const questionId of questionOrder) {
    const reference = selected.find((item) => item.questionId === questionId)!;
    const question = questionById.get(questionId)!;
    const context = await derivePracticeDtoContext({
      jwtSecret: input.jwtSecret,
      sessionId: claims.sessionId,
      quizId: reference.quizId,
      revision: reference.revision,
    });
    const submitted = input.answers[questionId];
    try {
      await validatePracticeStructuredAnswer(question, submitted, context);
      const rebased = await rebasePracticeAnswerForGrading(question, submitted, context);
      if (hasMeaningfulAnswer(rebased)) canonicalAnswers[questionId] = rebased;
    } catch (error) {
      throw errorFromPresentation(error);
    }
    const scopeKey = `${reference.quizId}\u0000${reference.revision}`;
    const group = questionsByScope.get(scopeKey) ?? { questions: [], answers: {}, context };
    group.questions.push(question);
    if (hasMeaningfulAnswer(canonicalAnswers[questionId])) group.answers[questionId] = canonicalAnswers[questionId];
    questionsByScope.set(scopeKey, group);
  }

  for (const group of questionsByScope.values()) {
    try {
      const decoded = await decodeStudentAnswersForGrading(group.questions, group.answers, group.context);
      Object.assign(canonicalAnswers, decoded);
    } catch (error) {
      throw errorFromPresentation(error);
    }
  }

  const grading = gradeQuiz({ questions }, canonicalAnswers);
  const reviewDetails = buildAuthoritativeReviewDetails(questions, canonicalAnswers, grading.details);
  const expectedIds = new Set(selected.map((reference) => reference.questionId));
  const reviewIds = new Set(reviewDetails.map((detail) => detail.questionId));
  if (reviewDetails.length !== expectedIds.size || reviewIds.size !== expectedIds.size
    || [...expectedIds].some((questionId) => !reviewIds.has(questionId))) {
    throw new PracticeGradingError('PRACTICE_REVIEW_INCOMPLETE', 'Practice review could not be completed safely.', 500);
  }
  const answers = buildAuthoritativeStoredAnswers(questions, canonicalAnswers, grading.details);
  return {
    status: 'success',
    practiceId: claims.practiceId,
    score: grading.score,
    correctCount: grading.correctCount,
    questionCount: grading.questionCount,
    totalQuestions: grading.totalQuestions,
    voidedCount: grading.voidedCount,
    gradingVersion: grading.engineVersion,
    answers,
    validationDetails: grading.details,
    reviewDetails,
  };
}

export const PRACTICE_GRADING_VERSION = `${PRACTICE_DELIVERY_VERSION}:${'2.0.0'}` as const;
