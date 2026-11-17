import { deserializeQuestionRichText } from '../../../shared/question-rich-text.contract';
import { sanitizeSvgDiagram } from './svgDiagramSanitizer';

export interface StudentQuizQuestionDtoContext {
  quizId: string;
  revision: number;
  scope: string;
  key: string | Uint8Array;
}

export interface StudentQuizDtoActor {
  id?: string;
  username?: string;
  role?: string;
}

export interface StudentQuizQuestionDto {
  id: string;
  type: string;
  [key: string]: unknown;
}

export class StudentQuizQuestionDtoError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'StudentQuizQuestionDtoError';
  }
}

const textEncoder = new TextEncoder();
const STUDENT_QUIZ_DTO_KDF_CONTEXT = 'tohieuquiz-student-question-dto-key-v1';

const asRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
);

const parseArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const asString = (value: unknown): string => String(value ?? '');

const keyBytes = (key: string | Uint8Array): Uint8Array => (
  typeof key === 'string' ? textEncoder.encode(key) : key
);

async function hmacHex(key: string | Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function deriveStudentQuizDtoKey(sourceMaterial: string): Promise<string> {
  return hmacHex(sourceMaterial, STUDENT_QUIZ_DTO_KDF_CONTEXT);
}

export function deriveStudentQuizDtoScope(input: {
  quizId: string;
  actor: StudentQuizDtoActor | null;
  assignmentId?: string;
}): string {
  const actor = input.actor;
  const subject = actor
    ? `${actor.role || 'user'}:${actor.id || actor.username || 'unknown'}`
    : 'guest';
  // JSON tuple encoding keeps scope components unambiguous even when an ID
  // contains delimiters.  The scope is an HMAC input, not a user-facing ID.
  return JSON.stringify(['student-question-dto-v1', subject, input.quizId, input.assignmentId || 'public']);
}

const opaqueId = async (
  context: StudentQuizQuestionDtoContext,
  questionId: string,
  side: 'left' | 'right' | 'blank',
  index: number,
): Promise<string> => {
  const message = [
    'tohieuquiz-student-question-dto-v1',
    context.scope,
    context.quizId,
    context.revision,
    questionId,
    side,
    index,
  ].join('|');
  return `sq1_${(await hmacHex(context.key, message)).slice(0, 32)}`;
};

const rightSortKey = async (
  context: StudentQuizQuestionDtoContext,
  questionId: string,
  index: number,
): Promise<string> => hmacHex(
  context.key,
  ['tohieuquiz-student-question-dto-v1', context.scope, context.quizId, context.revision, questionId, 'right-order', index].join('|'),
);

const baseDto = (question: Record<string, any>, type: string): StudentQuizQuestionDto => {
  const dto: StudentQuizQuestionDto = {
    id: asString(question.id),
    type,
    question: asString(question.question ?? question.mainQuestion),
  };
  for (const field of ['mainQuestion', 'image', 'imageAlt', 'difficulty']) {
    if (question[field] !== undefined && question[field] !== null && field !== 'questionRichText') dto[field] = question[field];
  }
  const rawSvg = asString(question.svgContent ?? question.svg_content).trim();
  const svgAlt = asString(question.svgAlt ?? question.svg_alt).trim();
  const sanitizedSvg = rawSvg ? sanitizeSvgDiagram(rawSvg) : null;
  if (sanitizedSvg?.ok && sanitizedSvg.sanitizedSvg && svgAlt) {
    dto.svgContent = sanitizedSvg.sanitizedSvg;
    dto.svgAlt = svgAlt;
    dto.svgVersion = 1;
  }
  const richText = deserializeQuestionRichText(question.questionRichText ?? question.question_rich_text);
  if (richText) dto.questionRichText = richText;
  return dto;
};

const matchingPairs = (question: Record<string, any>): Array<{ left: string; right: string }> => {
  const source = parseArray(question.pairs ?? question.items);
  return source.map((pair) => {
    const record = asRecord(pair);
    return { left: asString(record.left), right: asString(record.right) };
  }).filter((pair) => pair.left !== '' && pair.right !== '');
};

const dragBlanks = (question: Record<string, any>): Array<{ id: string; answer: string; index: number }> => parseArray(question.blanks)
  .map((blank, index) => {
    const record = asRecord(blank);
    return {
      id: asString(record.id || `blank-${index}`),
      answer: asString(record.correctAnswer ?? record.answer ?? record.value ?? blank),
      index,
    };
  })
  .filter((blank) => blank.answer !== '');

export async function toStudentQuestionDto(
  questionInput: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<StudentQuizQuestionDto> {
  const question = asRecord(questionInput);
  const id = asString(question.id).trim();
  const type = asString(question.type ?? question.questionType).trim().toUpperCase();
  if (!id || !type || !context.quizId || !Number.isSafeInteger(context.revision) || !context.scope) {
    throw new StudentQuizQuestionDtoError('STUDENT_QUESTION_CONTEXT_INVALID', 'Question DTO context is invalid.');
  }

  const dto = baseDto(question, type);
  if (type === 'MATCHING') {
    const pairs = matchingPairs(question);
    const leftItems = await Promise.all(pairs.map(async (pair, index) => ({
      id: await opaqueId(context, id, 'left', index),
      content: pair.left,
    })));
    const rightItems = await Promise.all(pairs.map(async (pair, index) => ({
      id: await opaqueId(context, id, 'right', index),
      content: pair.right,
      order: await rightSortKey(context, id, index),
    })));
    rightItems.sort((a, b) => a.order.localeCompare(b.order));
    dto.leftItems = leftItems;
    dto.rightItems = rightItems.map(({ order: _order, ...item }) => item);
    return dto;
  }

  if (type === 'DRAG_DROP') {
    const blanks = dragBlanks(question);
    dto.text = asString(question.text ?? question.text_field ?? question.content);
    dto.blanks = await Promise.all(blanks.map(async (blank) => ({
      id: await opaqueId(context, id, 'blank', blank.index),
    })));
    const pool = [
      ...blanks.map((blank) => blank.answer),
      ...parseArray(question.distractors).map((value) => asString(value)).filter(Boolean),
    ];
    const poolWithOrder = await Promise.all(pool.map(async (value, index) => ({
      value,
      index,
      order: await hmacHex(
        context.key,
        ['tohieuquiz-student-question-dto-v1', context.scope, context.quizId, context.revision, id, 'pool-order', index].join('|'),
      ),
    })));
    poolWithOrder.sort((left, right) => left.order.localeCompare(right.order) || left.index - right.index);
    dto.answerPool = poolWithOrder.map((item) => item.value);
    return dto;
  }

  if (type === 'DROPDOWN') {
    dto.text = asString(question.text ?? question.text_field ?? question.content);
    dto.blanks = parseArray(question.blanks).map((blank, index) => {
      const record = asRecord(blank);
      return { id: asString(record.id || `blank-${index}`), options: Array.isArray(record.options) ? record.options.map(String) : [] };
    });
    return dto;
  }

  if (type === 'UNDERLINE') {
    dto.sentence = asString(question.sentence ?? question.text_field);
    dto.words = parseArray(question.words ?? question.items).map(asString);
    return dto;
  }

  const textList = (value: unknown): string[] => parseArray(value).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    const record = asRecord(item);
    return asString(record.text ?? record.content ?? record.statement ?? record.label ?? record.name);
  }).filter(Boolean);

  if (type === 'MCQ' || type === 'MULTIPLE_SELECT' || type === 'IMAGE_QUESTION') {
    dto.options = textList(question.options);
    if (type === 'IMAGE_QUESTION') dto.optionImages = textList(question.optionImages ?? question.distractors);
    return dto;
  }

  if (type === 'TRUE_FALSE') {
    dto.items = parseArray(question.items).map((item) => {
      const record = asRecord(item);
      return { id: asString(record.id), statement: asString(record.statement ?? record.text ?? record.content) };
    }).filter((item) => item.id && item.statement);
    return dto;
  }

  if (type === 'ORDERING' || type === 'WORD_SCRAMBLE' || type === 'RIDDLE') {
    const list = textList(
      type === 'ORDERING' ? question.items : type === 'WORD_SCRAMBLE' ? question.letters : question.riddleLines ?? question.items,
    );
    if (type === 'WORD_SCRAMBLE') dto.letters = list;
    else if (type === 'RIDDLE') dto.riddleLines = list;
    else dto.items = list;
    if (type === 'RIDDLE') {
      if (question.answerLabel !== undefined) dto.answerLabel = asString(question.answerLabel);
      if (question.hint !== undefined) dto.hint = asString(question.hint);
    }
    if (type === 'WORD_SCRAMBLE' && question.hint !== undefined) dto.hint = asString(question.hint);
    return dto;
  }

  if (type === 'CATEGORIZATION') {
    dto.categories = parseArray(question.categories ?? question.distractors).map((category) => {
      const record = asRecord(category);
      return { id: asString(record.id), name: asString(record.name ?? record.label ?? record.text) };
    }).filter((category) => category.id && category.name);
    dto.items = parseArray(question.items).map((item) => {
      const record = asRecord(item);
      return { id: asString(record.id), content: asString(record.content ?? record.text ?? record.label) };
    }).filter((item) => item.id && item.content);
    return dto;
  }

  if (type === 'ERROR_CORRECTION') {
    dto.passage = asString(question.passage ?? question.text_field);
    return dto;
  }

  if (Array.isArray(question.options) || typeof question.options === 'string') dto.options = textList(question.options);
  return dto;
}

export const isOpaqueStudentQuestionId = (value: unknown): value is string => (
  typeof value === 'string' && value.startsWith('sq1_')
);

/**
 * Detect the student DTO contract without inspecting arbitrary answer content.
 * Current renderers emit direct maps; typed/pairs/values envelopes are also
 * accepted for compatibility. Any structured opaque identifier forces the
 * strict decoder path, including mixed legacy/opaque submissions.
 */
export function hasOpaqueStudentAnswerIds(answersInput: unknown): boolean {
  const answers = answersInput && typeof answersInput === 'object' && !Array.isArray(answersInput)
    ? answersInput as Record<string, unknown>
    : {};
  const unwrap = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && Object.prototype.hasOwnProperty.call(value, 'selectedAnswer')) {
      return unwrap((value as Record<string, unknown>).selectedAnswer);
    }
    return value;
  };
  return Object.values(answers).some((rawAnswer) => {
    const answer = unwrap(rawAnswer);
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
    const record = answer as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.toUpperCase() : '';
    if (type === 'MATCHING') {
      const pairs = record.pairs && typeof record.pairs === 'object' ? record.pairs : record;
      return Object.entries(pairs as Record<string, unknown>)
        .filter(([key]) => !['type', 'selectedLeft', '__shuffledIds'].includes(key))
        .some(([leftId, rightId]) => isOpaqueStudentQuestionId(leftId) || isOpaqueStudentQuestionId(rightId));
    }
    if (type === 'DRAG_DROP') {
      const values = record.values && typeof record.values === 'object' ? record.values : record;
      return Object.keys(values as Record<string, unknown>).some(isOpaqueStudentQuestionId);
    }
    const directEntries = Object.entries(record)
      .filter(([key]) => !['type', 'selectedLeft', '__shuffledIds'].includes(key));
    if (directEntries.some(([key]) => isOpaqueStudentQuestionId(key))) return true;
    return directEntries.some(([key, value]) => (
      /^(?:left|l)-\d+$/.test(key) && isOpaqueStudentQuestionId(value)
    ));
  });
}

// This is the only root-level UI metadata emitted by the current student
// player. It is intentionally allowlisted here instead of accepting every
// underscore-prefixed field from a client result envelope.
const ROOT_STUDENT_ANSWER_METADATA = new Set(['_questionOrder']);

const normalizeSubmittedAnswerMap = (
  answersInput: Record<string, any>,
  knownQuestionIds: Set<string>,
): Record<string, any> => {
  const normalized: Record<string, any> = {};
  for (const [questionId, value] of Object.entries(answersInput)) {
    if (ROOT_STUDENT_ANSWER_METADATA.has(questionId)) continue;
    if (!knownQuestionIds.has(questionId)) {
      throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_QUESTION_INVALID', 'Answer references an unknown question.');
    }
    if (value && typeof value === 'object' && !Array.isArray(value)
      && Object.prototype.hasOwnProperty.call(value, 'selectedAnswer')) {
      // Discard client isCorrect/status/snapshot/grading metadata. Only the
      // submitted answer value crosses into the decoder and scoring engine.
      normalized[questionId] = (value as Record<string, unknown>).selectedAnswer;
    } else {
      normalized[questionId] = value;
    }
  }
  return normalized;
};

async function decodeMatchingAnswer(
  question: Record<string, any>,
  answer: Record<string, any>,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  const pairs = matchingPairs(question);
  const leftMap = new Map<string, string>();
  const rightMap = new Map<string, string>();
  const legacyLeftMap = new Map<string, string>();
  const legacyRightMap = new Map<string, string>();
  for (let index = 0; index < pairs.length; index += 1) {
    leftMap.set(await opaqueId(context, asString(question.id), 'left', index), `left-${index}`);
    rightMap.set(await opaqueId(context, asString(question.id), 'right', index), `right-${index}`);
    legacyLeftMap.set(`left-${index}`, `left-${index}`);
    legacyLeftMap.set(`l-${index}`, `left-${index}`);
    legacyRightMap.set(`right-${index}`, `right-${index}`);
    legacyRightMap.set(`r-${index}`, `right-${index}`);
  }
  const rawPairs = asRecord(answer.pairs ?? answer);
  const entries = Object.entries(rawPairs).filter(([leftId]) => !['type', 'selectedLeft', '__shuffledIds'].includes(leftId));
  const decoded: Record<string, string> = {};
  const allOpaque = entries.every(([leftId, rightId]) => isOpaqueStudentQuestionId(leftId) && isOpaqueStudentQuestionId(rightId));
  const allLegacy = entries.every(([leftId, rightId]) => legacyLeftMap.has(leftId) && legacyRightMap.has(String(rightId)));
  if (entries.length > 0 && !allOpaque && !allLegacy) {
    throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_ID_INVALID', 'Matching answer IDs must use one valid contract.');
  }
  for (const [leftId, rightId] of entries) {
    const canonicalLeft = allLegacy ? legacyLeftMap.get(leftId) : leftMap.get(leftId);
    const canonicalRight = allLegacy ? legacyRightMap.get(String(rightId)) : rightMap.get(String(rightId));
    if (!canonicalLeft || !canonicalRight) throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_SCOPE_INVALID', 'Matching answer ID is outside the active scope.');
    decoded[canonicalLeft] = canonicalRight;
  }
  return { type: 'MATCHING', pairs: decoded };
}

async function decodeDragAnswer(
  question: Record<string, any>,
  answer: Record<string, any>,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  const blanks = dragBlanks(question);
  const blankMap = new Map<string, string>();
  const legacyBlankMap = new Map<string, string>();
  for (const blank of blanks) {
    blankMap.set(await opaqueId(context, asString(question.id), 'blank', blank.index), blank.id);
    legacyBlankMap.set(blank.id, blank.id);
    legacyBlankMap.set(`blank-${blank.index}`, blank.id);
  }
  const rawValues = asRecord(answer.values ?? answer);
  const entries = Object.entries(rawValues).filter(([blankId]) => blankId !== 'type');
  const decoded: Record<string, string> = {};
  const allOpaque = entries.every(([blankId]) => isOpaqueStudentQuestionId(blankId));
  const allLegacy = entries.every(([blankId]) => legacyBlankMap.has(blankId));
  if (entries.length > 0 && !allOpaque && !allLegacy) {
    throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_ID_INVALID', 'Blank answer IDs must use one valid contract.');
  }
  for (const [blankId, value] of entries) {
    const canonicalBlank = allLegacy ? legacyBlankMap.get(blankId) : blankMap.get(blankId);
    if (!canonicalBlank) throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_SCOPE_INVALID', 'Blank answer ID is outside the active scope.');
    decoded[canonicalBlank] = asString(value);
  }
  return { type: 'DRAG_DROP', values: decoded };
}

const canonicalIndex = (value: unknown, prefix: 'left' | 'right'): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(new RegExp(`^(?:${prefix}|${prefix[0]})-(\\d+)$`));
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isSafeInteger(index) && index >= 0 ? index : null;
};

async function encodeMatchingAnswer(
  question: Record<string, any>,
  answer: Record<string, any>,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  const pairs = matchingPairs(question);
  const rawPairs = asRecord(answer.pairs ?? answer);
  const entries = Object.entries(rawPairs).filter(([leftId]) => !['type', 'selectedLeft', '__shuffledIds'].includes(leftId));
  const encoded: Record<string, string> = {};
  for (const [leftId, rightId] of entries) {
    const leftIndex = canonicalIndex(leftId, 'left');
    const rightIndex = canonicalIndex(rightId, 'right');
    if (leftIndex === null || rightIndex === null || leftIndex >= pairs.length || rightIndex >= pairs.length) {
      throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_CANONICAL_INVALID', 'Canonical matching answer is invalid.');
    }
    encoded[
      await opaqueId(context, asString(question.id), 'left', leftIndex)
    ] = await opaqueId(context, asString(question.id), 'right', rightIndex);
  }
  return encoded;
}

async function encodeDragAnswer(
  question: Record<string, any>,
  answer: Record<string, any>,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  const blanks = dragBlanks(question);
  const blankIndexes = new Map<string, number>();
  blanks.forEach((blank, index) => {
    blankIndexes.set(blank.id, index);
    blankIndexes.set(`blank-${index}`, index);
  });
  const rawValues = asRecord(answer.values ?? answer);
  const entries = Object.entries(rawValues).filter(([blankId]) => blankId !== 'type');
  const encoded: Record<string, string> = {};
  for (const [blankId, value] of entries) {
    const index = blankIndexes.get(blankId);
    if (index === undefined) {
      throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_CANONICAL_INVALID', 'Canonical blank answer is invalid.');
    }
    encoded[await opaqueId(context, asString(question.id), 'blank', index)] = asString(value);
  }
  return encoded;
}

/** Re-encode canonical live snapshot answers for the same scoped student UI. */
export async function encodeStudentAnswersForPresentation(
  questionsInput: unknown[],
  answersInput: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  const questions = questionsInput.map(asRecord);
  const answers = asRecord(answersInput);
  const knownQuestionIds = new Set(questions.map((question) => asString(question.id)));
  const encoded: Record<string, any> = {};
  for (const [questionId, answer] of Object.entries(answers)) {
    if (!knownQuestionIds.has(questionId)) {
      throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_QUESTION_INVALID', 'Answer references an unknown question.');
    }
    const question = questions.find((candidate) => asString(candidate.id) === questionId) || {};
    const type = asString(question.type).toUpperCase();
    if (type === 'MATCHING') encoded[questionId] = await encodeMatchingAnswer(question, asRecord(answer), context);
    else if (type === 'DRAG_DROP') encoded[questionId] = await encodeDragAnswer(question, asRecord(answer), context);
    else encoded[questionId] = answer;
  }
  return encoded;
}

export async function decodeStudentAnswersForGrading(
  questionsInput: unknown[],
  answersInput: unknown,
  context: StudentQuizQuestionDtoContext,
): Promise<Record<string, any>> {
  if (!context.quizId || !context.scope || !Number.isSafeInteger(context.revision)) {
    throw new StudentQuizQuestionDtoError('STUDENT_ANSWER_SCOPE_INVALID', 'Answer scope is invalid.');
  }
  const questions = questionsInput.map(asRecord);
  const answers = asRecord(answersInput);
  const knownQuestionIds = new Set(questions.map((question) => asString(question.id)));
  const normalizedAnswers = normalizeSubmittedAnswerMap(answers, knownQuestionIds);
  const decoded: Record<string, any> = { ...normalizedAnswers };
  for (const question of questions) {
    const questionId = asString(question.id);
    const answer = asRecord(normalizedAnswers[questionId]);
    if (!Object.keys(answer).length) continue;
    const type = asString(question.type).toUpperCase();
    if (type === 'MATCHING') decoded[questionId] = await decodeMatchingAnswer(question, answer, context);
    if (type === 'DRAG_DROP') decoded[questionId] = await decodeDragAnswer(question, answer, context);
  }
  return decoded;
}
