import { callApi } from './apiAdapter';
import type { Question } from '../types';
export interface QuizAccessVerificationResponse {
  valid: boolean;
  accessGrant?: string;
  expiresAt?: string;
  revision?: number;
}

export interface QuizPlayQuestionsResponse {
  quizId: string;
  revision: number;
  questions: Record<string, unknown>[];
}

type StudentQuestionRecord = Record<string, unknown>;

const asRecord = (value: unknown): StudentQuestionRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as StudentQuestionRecord
    : {}
);

const asString = (value: unknown): string => String(value ?? '');
const asStringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.map(asString) : []
);

/**
 * Adapt the server's allow-listed learner DTO without passing it through the
 * authoring-row normalizer. The DTO deliberately has no answer key and its
 * structured IDs are opaque, so this adapter only copies presentation fields.
 */
export const adaptStudentQuizQuestion = (input: StudentQuestionRecord): Question => {
  const row = asRecord(input);
  const id = asString(row.id).trim();
  const type = asString(row.type).trim().toUpperCase();
  const question: StudentQuestionRecord = {
    id,
    type,
    question: asString(row.question ?? row.mainQuestion),
  };

  for (const field of [
    'mainQuestion', 'image', 'imageAlt', 'difficulty', 'questionRichText',
    'svgContent', 'svgAlt', 'svgVersion', 'mathFormatVersion',
  ]) {
    if (row[field] !== undefined && row[field] !== null) question[field] = row[field];
  }

  if (type === 'MATCHING') {
    question.leftItems = Array.isArray(row.leftItems)
      ? row.leftItems.map((item) => {
        const value = asRecord(item);
        return { id: asString(value.id), content: asString(value.content) };
      }).filter((item) => item.id)
      : [];
    question.rightItems = Array.isArray(row.rightItems)
      ? row.rightItems.map((item) => {
        const value = asRecord(item);
        return { id: asString(value.id), content: asString(value.content) };
      }).filter((item) => item.id)
      : [];
  } else if (type === 'DRAG_DROP') {
    question.text = asString(row.text);
    question.blanks = Array.isArray(row.blanks)
      ? row.blanks.map((blank) => ({ id: asString(asRecord(blank).id) })).filter((blank) => blank.id)
      : [];
    question.answerPool = asStringArray(row.answerPool);
  } else if (type === 'DROPDOWN') {
    question.text = asString(row.text);
    question.blanks = Array.isArray(row.blanks)
      ? row.blanks.map((blank) => {
        const value = asRecord(blank);
        return { id: asString(value.id), options: asStringArray(value.options) };
      }).filter((blank) => blank.id)
      : [];
  } else if (type === 'UNDERLINE') {
    // Preserve the DTO word boundaries and punctuation exactly as sent.
    question.sentence = asString(row.sentence);
    question.words = asStringArray(row.words);
  } else if (type === 'MCQ' || type === 'MULTIPLE_SELECT' || type === 'IMAGE_QUESTION') {
    question.options = asStringArray(row.options);
    if (type === 'IMAGE_QUESTION') question.optionImages = asStringArray(row.optionImages);
  } else if (type === 'TRUE_FALSE') {
    question.items = Array.isArray(row.items)
      ? row.items.map((item) => {
        const value = asRecord(item);
        return { id: asString(value.id), statement: asString(value.statement) };
      }).filter((item) => item.id && item.statement)
      : [];
  } else if (type === 'ORDERING') {
    question.items = asStringArray(row.items);
  } else if (type === 'WORD_SCRAMBLE') {
    question.letters = asStringArray(row.letters);
    if (row.hint !== undefined) question.hint = asString(row.hint);
  } else if (type === 'RIDDLE') {
    question.riddleLines = asStringArray(row.riddleLines);
    if (row.answerLabel !== undefined) question.answerLabel = asString(row.answerLabel);
    if (row.hint !== undefined) question.hint = asString(row.hint);
  } else if (type === 'CATEGORIZATION') {
    question.categories = Array.isArray(row.categories)
      ? row.categories.map((category) => {
        const value = asRecord(category);
        return { id: asString(value.id), name: asString(value.name) };
      }).filter((category) => category.id && category.name)
      : [];
    question.items = Array.isArray(row.items)
      ? row.items.map((item) => {
        const value = asRecord(item);
        return { id: asString(value.id), content: asString(value.content) };
      }).filter((item) => item.id && item.content)
      : [];
  } else if (type === 'ERROR_CORRECTION') {
    question.passage = asString(row.passage);
  }

  return question as unknown as Question;
};

const normalizeQuizId = (quizId: string): string => String(quizId || '').trim();
const normalizeAccessCode = (rawCode: string): string => String(rawCode || '').trim().toUpperCase();

export const requestQuizAccess = async (
  quizId: string,
  rawCode: string,
  assignmentId?: string,
): Promise<QuizAccessVerificationResponse> => {
  const normalizedQuizId = normalizeQuizId(quizId);
  const accessCode = normalizeAccessCode(rawCode);
  if (!normalizedQuizId || !/^[A-Z0-9]{1,10}$/.test(accessCode)) return { valid: false };

  try {
    return await callApi<QuizAccessVerificationResponse>('verify_quiz_access_code', {
      quizId: normalizedQuizId,
      accessCode,
      ...(assignmentId?.trim() ? { assignmentId: assignmentId.trim() } : {}),
    });
  } catch (error) {
    const status = error && typeof error === 'object'
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;
    if (status === 400 || status === 403) return { valid: false };
    throw error;
  }
};

export const fetchQuizPlayQuestions = async (
  quizId: string,
  options: { assignmentId?: string; accessGrant?: string } = {},
): Promise<QuizPlayQuestionsResponse> => {
  const normalizedQuizId = normalizeQuizId(quizId);
  if (!normalizedQuizId) throw new Error('Quiz ID is required.');

  return callApi<QuizPlayQuestionsResponse>('get_quiz_play_questions', {
    quizId: normalizedQuizId,
    ...(options.assignmentId?.trim() ? { assignmentId: options.assignmentId.trim() } : {}),
    ...(options.accessGrant?.trim() ? { accessGrant: options.accessGrant.trim() } : {}),
  });
};

export const verifyQuizAccessCode = async (
  quizId: string,
  rawCode: string,
): Promise<boolean> => {
  const response = await requestQuizAccess(quizId, rawCode);
  return response.valid === true;
};
