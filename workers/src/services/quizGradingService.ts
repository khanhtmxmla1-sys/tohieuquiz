import {
  QUIZ_ANSWER_SCHEMA_VERSION,
  QUIZ_SCORING_ENGINE_VERSION,
  buildQuestionAnswerReview,
  gradeQuiz,
  isRawAnswerSkipped,
  normalizeQuestionForGrading,
  unwrapStoredResultAnswer,
  type ReviewPresentation,
  type ReviewPresentationSource,
  type QuestionAnswerReview,
  type QuestionGradingResult,
} from '../../../src/domain/quiz-scoring';
import { deserializeQuestionRichText } from '../../../shared/question-rich-text.contract';
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
  return buildReviewDetailsForSource(questions, submittedAnswers, details, 'submission');
}

export const STORED_REVIEW_DETAILS_KEY = '_reviewDetails' as const;
export const STORED_REVIEW_DETAILS_SCHEMA_VERSION = 1 as const;

export interface StoredReviewDetailsMetadata {
  schemaVersion: typeof STORED_REVIEW_DETAILS_SCHEMA_VERSION;
  source: 'submission';
  details: QuestionAnswerReview[];
}

const REVIEW_STATUSES = new Set(['correct', 'wrong', 'skipped', 'invalid', 'voided']);
const REVIEW_SOURCES = new Set(['submission', 'verified-current', 'legacy-unverified']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const isAnswerReviewValue = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.kind !== 'string' || !Array.isArray(value.lines)) return false;
  return value.lines.every((line) => isRecord(line) && typeof line.value === 'string');
};

const isReviewPresentation = (value: unknown): value is ReviewPresentation => {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.source !== 'string'
    || !REVIEW_SOURCES.has(value.source) || typeof value.type !== 'string' || !Array.isArray(value.items)) {
    return false;
  }
  return value.items.every((item) => isRecord(item) && typeof item.id === 'string');
};

const isQuestionAnswerReview = (value: unknown): value is QuestionAnswerReview => {
  if (!isRecord(value) || typeof value.questionId !== 'string' || !value.questionId
    || typeof value.type !== 'string' || !REVIEW_STATUSES.has(String(value.status))
    || typeof value.isCorrect !== 'boolean'
    || !isAnswerReviewValue(value.studentAnswer) || !isAnswerReviewValue(value.correctAnswer)) {
    return false;
  }
  return value.presentation === undefined || isReviewPresentation(value.presentation);
};

/**
 * Read the additive review metadata stored inside a result's answers JSON.
 * Invalid metadata is ignored so legacy answer envelopes remain readable.
 */
export function readStoredReviewMetadata(storedAnswers: unknown): StoredReviewDetailsMetadata | null {
  if (!isRecord(storedAnswers)) return null;
  const raw = storedAnswers[STORED_REVIEW_DETAILS_KEY];
  if (!isRecord(raw) || raw.schemaVersion !== STORED_REVIEW_DETAILS_SCHEMA_VERSION
    || raw.source !== 'submission' || !Array.isArray(raw.details) || raw.details.length === 0) {
    return null;
  }
  const details = raw.details.filter(isQuestionAnswerReview);
  if (details.length !== raw.details.length) return null;
  const ids = new Set(details.map((detail) => detail.questionId));
  if (ids.size !== details.length) return null;
  return {
    schemaVersion: STORED_REVIEW_DETAILS_SCHEMA_VERSION,
    source: 'submission',
    details,
  };
}

export const readStoredReviewDetails = (storedAnswers: unknown): QuestionAnswerReview[] | null => (
  readStoredReviewMetadata(storedAnswers)?.details ?? null
);

export function attachReviewDetailsToStoredAnswers(
  storedAnswers: Record<string, unknown>,
  details: readonly QuestionAnswerReview[],
): Record<string, unknown> {
  return {
    ...storedAnswers,
    [STORED_REVIEW_DETAILS_KEY]: {
      schemaVersion: STORED_REVIEW_DETAILS_SCHEMA_VERSION,
      source: 'submission',
      details: [...details],
    } satisfies StoredReviewDetailsMetadata,
  };
}

/**
 * Attach review metadata only when the complete answers envelope remains
 * within the conservative D1 payload budget. Oversized metadata is omitted
 * so submitting a result never fails solely because review details duplicate
 * a large question payload; the result remains readable through the legacy
 * unverified path.
 */
export function attachReviewDetailsWithinBudget(
  storedAnswers: Record<string, unknown>,
  details: readonly QuestionAnswerReview[],
): Record<string, unknown> {
  const candidate = attachReviewDetailsToStoredAnswers(storedAnswers, details);
  const candidateAnswersBytes = utf8ByteLength(JSON.stringify(candidate));
  if (candidateAnswersBytes <= MAX_RESULT_ANSWERS_WITH_RICH_BYTES) return candidate;

  console.info(JSON.stringify({
    event: 'result_review_metadata_budget_exceeded',
    candidateAnswersBytes,
    limitBytes: MAX_RESULT_ANSWERS_WITH_RICH_BYTES,
    reviewDetailsCount: details.length,
  }));
  return storedAnswers;
}

export const attachStoredReviewMetadata = attachReviewDetailsToStoredAnswers;

export function buildReviewDetailsForSource(
  questions: readonly Record<string, unknown>[],
  answers: unknown,
  details: readonly QuestionGradingResult[],
  source: ReviewPresentationSource,
): QuestionAnswerReview[] {
  const answerMap = isRecord(answers) ? answers : {};
  const detailMap = new Map(details.map((detail) => [detail.questionId, detail]));
  return questions.map((question) => {
    const questionId = String(question.id ?? '');
    return buildQuestionAnswerReview(
      question,
      answerMap[questionId],
      detailMap.get(questionId),
      { source },
    );
  });
}

export function buildVerifiedCurrentReviewDetails(
  questions: readonly Record<string, unknown>[],
  storedAnswers: unknown,
  details: readonly QuestionGradingResult[],
): QuestionAnswerReview[] {
  return buildReviewDetailsForSource(questions, storedAnswers, details, 'verified-current');
}

const parseList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Pipe-separated options are the legacy D1 representation.
  }
  return value.split('|');
};

const itemText = (value: unknown): string => {
  if (!isRecord(value)) return String(value ?? '').trim();
  return String(value.text ?? value.content ?? value.label ?? value.name ?? value.statement ?? value.left ?? '').trim();
};

const itemIdentity = (value: unknown, fallback: string): string => (
  isRecord(value) && value.id !== undefined ? String(value.id) : fallback
);

const optionProjection = (value: unknown): Array<{ id: string; text: string }> => (
  parseList(value).map((option, index) => ({
    id: itemIdentity(option, `option-${index}`),
    text: itemText(option),
  }))
);

const itemProjection = (value: unknown): Array<{ id: string; text: string }> => (
  parseList(value).map((item, index) => ({
    id: itemIdentity(item, `item-${index}`),
    text: itemText(item),
  }))
);

const pairProjection = (value: unknown): Array<{ left: string; right: string }> => (
  parseList(value).map((pair) => {
    const record = isRecord(pair) ? pair : {};
    return { left: String(record.left ?? record.leftText ?? '').trim(), right: String(record.right ?? record.rightText ?? '').trim() };
  })
);

const blankProjection = (value: unknown): Array<{ id: string; options: string[] }> => (
  parseList(value).map((blank, index) => {
    const record = isRecord(blank) ? blank : {};
    return {
      id: itemIdentity(blank, `blank-${index}`),
      options: parseList(record.options).map((option) => itemText(option)),
    };
  })
);

const canonicalType = (question: Record<string, unknown>): string => {
  const normalized = normalizeQuestionForGrading({ id: String(question.id ?? 'compatibility'), type: question.type });
  return normalized.ok ? normalized.question.type : normalized.type;
};

const textField = (question: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    if (question[key] !== undefined && question[key] !== null) return String(question[key]).trim();
  }
  return '';
};

const firstNonEmptyTextField = (question: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = question[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};

const promptsMatch = (
  snapshot: Record<string, unknown>,
  currentQuestion: Record<string, unknown>,
  ...keys: string[]
): boolean => {
  const snapshotPrompt = firstNonEmptyTextField(snapshot, ...keys);
  const currentPrompt = firstNonEmptyTextField(currentQuestion, ...keys);
  return Boolean(snapshotPrompt && currentPrompt && snapshotPrompt === currentPrompt);
};

const stableJson = (value: unknown): string => JSON.stringify(value);

/**
 * Return only the canonical answer key for a question. Legacy snapshots are
 * eligible for current-key rendering only when this projection can be built
 * from both the snapshot and the current question. A visible-only snapshot
 * therefore remains unverified instead of silently receiving a newer key.
 */
const authoritativeAnswerKeyProjection = (question: Record<string, unknown>): unknown => {
  const normalized = normalizeQuestionForGrading(question);
  if (!normalized.ok) return null;

  switch (normalized.question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return { correctOptionId: normalized.question.correctOptionId };
    case 'MULTIPLE_SELECT':
      return { correctOptionIds: normalized.question.correctOptionIds };
    case 'SHORT_ANSWER':
    case 'RIDDLE':
      return { acceptedValues: [...normalized.question.acceptedValues].sort() };
    case 'TRUE_FALSE':
      return { correctValues: normalized.question.correctValues };
    case 'MATCHING':
      return { correctPairs: normalized.question.correctPairs };
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return { correctValues: normalized.question.correctValues };
    case 'ORDERING':
      return { correctRanks: normalized.question.correctRanks };
    case 'CATEGORIZATION':
      return { correctCategories: normalized.question.correctCategories };
    case 'UNDERLINE':
      return { correctIndexes: normalized.question.correctIndexes };
    case 'WORD_SCRAMBLE':
      return { correctWord: normalized.question.correctWord };
    case 'ERROR_CORRECTION':
      return { wrongWord: normalized.question.wrongWord, correctWord: normalized.question.correctWord };
  }
};

const richTextField = (question: Record<string, unknown>): unknown => (
  question.questionRichText !== undefined
    ? question.questionRichText
    : question.question_rich_text
);

const richTextMatches = (
  snapshot: Record<string, unknown>,
  currentQuestion: Record<string, unknown>,
): boolean => {
  const snapshotRichText = richTextField(snapshot);
  const currentRichText = richTextField(currentQuestion);
  if ((snapshotRichText === undefined) !== (currentRichText === undefined)) return false;
  if (snapshotRichText === undefined) return true;
  const normalizedSnapshot = deserializeQuestionRichText(snapshotRichText) ?? snapshotRichText;
  const normalizedCurrent = deserializeQuestionRichText(currentRichText) ?? currentRichText;
  return stableJson(normalizedSnapshot) === stableJson(normalizedCurrent);
};

/**
 * Compare only question presentation fields that survive stripCorrectFields.
 * A minimal `{id, type}` snapshot is intentionally not considered compatible.
 */
export function areReviewSnapshotsCompatible(
  snapshot: unknown,
  currentQuestion: Record<string, unknown>,
): boolean {
  if (!isRecord(snapshot)) return false;
  const currentType = canonicalType(currentQuestion);
  const snapshotType = canonicalType(snapshot);
  if (!currentType || currentType !== snapshotType
    || String(snapshot.id ?? '') !== String(currentQuestion.id ?? '')) return false;

  if (!richTextMatches(snapshot, currentQuestion)) return false;

  const snapshotAnswerKey = authoritativeAnswerKeyProjection(snapshot);
  const currentAnswerKey = authoritativeAnswerKeyProjection(currentQuestion);
  if (snapshotAnswerKey === null || currentAnswerKey === null
    || stableJson(snapshotAnswerKey) !== stableJson(currentAnswerKey)) return false;

  switch (currentType) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
    case 'MULTIPLE_SELECT': {
      const snapshotOptions = optionProjection(snapshot.options);
      return snapshotOptions.length >= 2
        && stableJson(snapshotOptions) === stableJson(optionProjection(currentQuestion.options))
        && promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && (currentType !== 'IMAGE_QUESTION'
          || textField(snapshot, 'image') === textField(currentQuestion, 'image'));
    }
    case 'TRUE_FALSE':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && itemProjection(snapshot.items).length > 0
        && stableJson(itemProjection(snapshot.items)) === stableJson(itemProjection(currentQuestion.items));
    case 'MATCHING':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && pairProjection(snapshot.pairs ?? snapshot.items).length > 0
        && stableJson(pairProjection(snapshot.pairs ?? snapshot.items))
          === stableJson(pairProjection(currentQuestion.pairs ?? currentQuestion.items));
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return promptsMatch(snapshot, currentQuestion, 'text', 'question', 'mainQuestion')
        && blankProjection(snapshot.blanks).length > 0
        && stableJson(blankProjection(snapshot.blanks)) === stableJson(blankProjection(currentQuestion.blanks));
    case 'ORDERING':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && itemProjection(snapshot.items).length > 0
        && stableJson(itemProjection(snapshot.items)) === stableJson(itemProjection(currentQuestion.items));
    case 'CATEGORIZATION':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && itemProjection(snapshot.items).length > 0
        && stableJson(itemProjection(snapshot.items)) === stableJson(itemProjection(currentQuestion.items))
        && stableJson(optionProjection(snapshot.categories ?? snapshot.distractors))
          === stableJson(optionProjection(currentQuestion.categories ?? currentQuestion.distractors));
    case 'UNDERLINE':
      return promptsMatch(snapshot, currentQuestion, 'sentence', 'question', 'mainQuestion')
        && itemProjection(snapshot.words ?? snapshot.items).length > 0
        && stableJson(itemProjection(snapshot.words ?? snapshot.items))
          === stableJson(itemProjection(currentQuestion.words ?? currentQuestion.items));
    case 'WORD_SCRAMBLE':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && itemProjection(snapshot.letters ?? snapshot.items).length > 1
        && stableJson(itemProjection(snapshot.letters ?? snapshot.items))
          === stableJson(itemProjection(currentQuestion.letters ?? currentQuestion.items));
    case 'RIDDLE':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion')
        && itemProjection(snapshot.riddleLines ?? snapshot.items).length > 0
        && stableJson(itemProjection(snapshot.riddleLines ?? snapshot.items))
          === stableJson(itemProjection(currentQuestion.riddleLines ?? currentQuestion.items));
    case 'ERROR_CORRECTION':
      return promptsMatch(snapshot, currentQuestion, 'passage', 'question', 'mainQuestion')
        && textField(snapshot, 'wrongWord') === textField(currentQuestion, 'wrongWord');
    case 'SHORT_ANSWER':
      return promptsMatch(snapshot, currentQuestion, 'question', 'mainQuestion');
    default:
      return false;
  }
}

const currentOutcomeAgreesWithStoredStatus = (
  review: QuestionAnswerReview,
  status: string,
): boolean => {
  const presentation = review.presentation;
  if (!presentation || presentation.type === 'UNSUPPORTED') return false;
  const items = Array.from(presentation.items as unknown as readonly unknown[], (item) => (
    item as Record<string, unknown>
  ));
  if (status === 'skipped') {
    return items.length > 0
      && items.some((item) => item.state === 'skipped')
      && items.every((item) => item.state !== 'correct' && item.state !== 'incorrect');
  }
  if (status !== 'correct' && status !== 'wrong') return false;
  if (status === 'correct') {
    if (presentation.type === 'MCQ' || presentation.type === 'IMAGE_QUESTION' || presentation.type === 'MULTIPLE_SELECT') {
      return items.every((item) => item.selected === item.correct);
    }
    return items.length > 0 && items.every((item) => item.state === 'correct');
  }
  return items.some((item) => item.state === 'incorrect' || item.state === 'skipped');
};

const storedDetailFor = (
  questionId: string,
  type: string,
  stored: Record<string, unknown>,
): QuestionGradingResult => {
  const selectedAnswer = unwrapStoredResultAnswer(stored);
  const rawStatus = String(stored.status ?? '');
  const status = REVIEW_STATUSES.has(rawStatus)
    ? rawStatus as QuestionGradingResult['status']
    : isRawAnswerSkipped(selectedAnswer)
      ? 'skipped'
      : stored.isCorrect === true
        ? 'correct'
        : stored.isCorrect === false
          ? 'wrong'
          : 'invalid';
  return {
    questionId,
    type,
    status,
    isCorrect: stored.isCorrect === true,
    normalizedStudentAnswer: selectedAnswer,
  };
};

const buildLegacyReview = (
  question: Record<string, unknown>,
  stored: Record<string, unknown>,
  detail: QuestionGradingResult,
): QuestionAnswerReview => {
  const snapshot = isRecord(stored.questionSnapshot)
    ? stripCorrectFields(stored.questionSnapshot) as Record<string, unknown>
    : { id: detail.questionId, type: detail.type };
  return buildQuestionAnswerReview(snapshot, unwrapStoredResultAnswer(stored), detail, { source: 'legacy-unverified' });
};

export function buildStoredResultReviewDetails(
  questions: readonly Record<string, unknown>[],
  storedAnswers: unknown,
): QuestionAnswerReview[] {
  const answerMap = isRecord(storedAnswers) ? storedAnswers : {};
  const details: QuestionAnswerReview[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const questionId = String(question.id ?? '');
    if (!questionId) continue;
    seen.add(questionId);
    const envelope = isRecord(answerMap[questionId])
      ? answerMap[questionId]
      : {};
    const detail = storedDetailFor(questionId, String(question.type ?? ''), envelope);
    const snapshot = envelope.questionSnapshot;
    if (!isRecord(snapshot) || !areReviewSnapshotsCompatible(snapshot, question)) {
      details.push(buildLegacyReview(question, envelope, detail));
      continue;
    }
    const currentReview = buildQuestionAnswerReview(question, envelope, detail, { source: 'verified-current' });
    details.push(currentOutcomeAgreesWithStoredStatus(currentReview, detail.status)
      ? currentReview
      : buildLegacyReview(question, envelope, detail));
  }

  // Preserve legacy answers for questions deleted from the current quiz.  They
  // are rendered from their sanitized snapshot only and never from a current key.
  for (const [questionId, value] of Object.entries(answerMap)) {
    if (questionId.startsWith('_') || seen.has(questionId) || !isRecord(value)) continue;
    const snapshot = isRecord(value.questionSnapshot) ? value.questionSnapshot : null;
    if (!snapshot) continue;
    const detail = storedDetailFor(questionId, String(snapshot.type ?? ''), value);
    details.push(buildLegacyReview(snapshot, value, detail));
  }
  return details;
}
