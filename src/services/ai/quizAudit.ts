import { QuestionType } from '../../types';
import type {
  QuizBlueprint,
  QuizBlueprintV3,
} from '../../features/quiz-generator/domain/quizBlueprint';
import { validateQuestionMath } from '../../utils/questionMath';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from './question-contracts/questionContract.types';
import {
  getAiQuestionContract,
  validateGeneratedQuestionSemantics,
} from './question-contracts/questionContractRegistry';
import type { GeneratedQuestion, GeneratedQuizPayload } from './schemas/quizGenerationSchema';

export type QuizAuditCode =
  | 'QUESTION_COUNT_MISMATCH'
  | 'TYPE_COUNT_MISMATCH'
  | 'DIFFICULTY_COUNT_MISMATCH'
  | 'DUPLICATE_QUESTION'
  | 'INVALID_ANSWER'
  | 'MISSING_EXPLANATION';

export interface QuizAuditIssue {
  code: QuizAuditCode;
  questionIndexes: number[];
  message: string;
  repairable: boolean;
}

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\d+(?:[.,]\d+)?/g, '#')
  .replace(/[^a-z0-9#]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const similarity = (left: string, right: string): number => {
  const a = new Set(normalize(left).split(' ').filter(Boolean));
  const b = new Set(normalize(right).split(' ').filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
};

const questionText = (question: GeneratedQuestion): string => (
  question.type === QuestionType.TRUE_FALSE ? question.mainQuestion : question.question
);

const hasValidLetterAnswer = (answer: string, optionCount: number): boolean => {
  if (!/^[A-Z]$/.test(answer)) return false;
  return answer.charCodeAt(0) - 65 < optionCount;
};

const hasInvalidAnswer = (question: GeneratedQuestion): boolean => {
  if (question.type === QuestionType.MCQ || question.type === QuestionType.IMAGE_QUESTION) {
    return !hasValidLetterAnswer(question.correctAnswer, question.options.length);
  }
  if (question.type === QuestionType.MULTIPLE_SELECT) {
    return new Set(question.correctAnswers).size !== question.correctAnswers.length
      || question.correctAnswers.some((answer) => !hasValidLetterAnswer(answer, question.options.length));
  }
  if (question.type === QuestionType.DROPDOWN) {
    return question.blanks.some((blank) => !blank.options.includes(blank.correctAnswer));
  }
  if (question.type === QuestionType.CATEGORIZATION) {
    const categoryIds = new Set(question.categories.map(({ id }) => id));
    return question.items.some(({ categoryId }) => !categoryIds.has(categoryId));
  }
  if (question.type === QuestionType.UNDERLINE) {
    return question.correctWordIndexes.some((index) => index >= question.words.length);
  }
  return false;
};

export function auditGeneratedQuiz(
  quiz: GeneratedQuizPayload,
  blueprint: QuizBlueprint,
): QuizAuditIssue[] {
  const issues: QuizAuditIssue[] = [];
  const questions = quiz.questions;

  if (questions.length !== blueprint.totalQuestions) {
    issues.push({
      code: 'QUESTION_COUNT_MISMATCH',
      questionIndexes: questions.length > blueprint.totalQuestions
        ? questions.map((_, index) => index).slice(blueprint.totalQuestions)
        : [],
      message: `Đề có ${questions.length} câu, blueprint yêu cầu ${blueprint.totalQuestions} câu.`,
      repairable: true,
    });
  }

  for (const allocation of blueprint.typeAllocations) {
    const indexes = questions
      .map((question, index) => question.type === allocation.type ? index : -1)
      .filter((index) => index >= 0);
    if (indexes.length !== allocation.count) {
      issues.push({
        code: 'TYPE_COUNT_MISMATCH',
        questionIndexes: indexes.length > allocation.count ? indexes.slice(allocation.count) : [],
        message: `${allocation.type} có ${indexes.length} câu, blueprint yêu cầu ${allocation.count} câu.`,
        repairable: true,
      });
    }
  }

  const allowedTypes = new Set(blueprint.typeAllocations.map(({ type }) => type));
  const unexpectedTypeIndexes = questions
    .map((question, index) => allowedTypes.has(question.type) ? -1 : index)
    .filter((index) => index >= 0);
  if (unexpectedTypeIndexes.length > 0) {
    issues.push({
      code: 'TYPE_COUNT_MISMATCH',
      questionIndexes: unexpectedTypeIndexes,
      message: 'Đề chứa dạng câu không có trong blueprint.',
      repairable: true,
    });
  }

  const difficultyExpected = [
    blueprint.difficultyLevels.level1,
    blueprint.difficultyLevels.level2,
    blueprint.difficultyLevels.level3,
  ];
  for (let level = 1; level <= 3; level += 1) {
    const indexes = questions
      .map((question, index) => question.difficultyLevel === level ? index : -1)
      .filter((index) => index >= 0);
    if (indexes.length !== difficultyExpected[level - 1]) {
      issues.push({
        code: 'DIFFICULTY_COUNT_MISMATCH',
        questionIndexes: indexes.length > difficultyExpected[level - 1]
          ? indexes.slice(difficultyExpected[level - 1])
          : [],
        message: `Mức độ ${level} có ${indexes.length} câu, blueprint yêu cầu ${difficultyExpected[level - 1]} câu.`,
        repairable: true,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      if (similarity(questionText(questions[leftIndex]), questionText(questions[rightIndex])) >= 0.88) {
        issues.push({
          code: 'DUPLICATE_QUESTION',
          questionIndexes: [rightIndex],
          message: `Câu ${leftIndex + 1} và câu ${rightIndex + 1} có nội dung gần trùng nhau.`,
          repairable: true,
        });
      }
    }
  }

  questions.forEach((question, index) => {
    if (!question.explanation.trim()) {
      issues.push({
        code: 'MISSING_EXPLANATION',
        questionIndexes: [index],
        message: `Câu ${index + 1} thiếu lời giải.`,
        repairable: true,
      });
    }
    if (hasInvalidAnswer(question)) {
      issues.push({
        code: 'INVALID_ANSWER',
        questionIndexes: [index],
        message: `Câu ${index + 1} có đáp án không hợp lệ.`,
        repairable: true,
      });
    }
  });

  return issues;
}

export type QuizSlotAuditCode =
  | 'ROOT_VERSION_MISMATCH'
  | 'MISSING_SLOT'
  | 'DUPLICATE_SLOT'
  | 'UNEXPECTED_SLOT'
  | 'SLOT_TYPE_MISMATCH'
  | 'SLOT_DIFFICULTY_MISMATCH'
  | 'SLOT_SKILL_MISMATCH'
  | 'QUESTION_SCHEMA_INVALID'
  | 'QUESTION_SEMANTIC_INVALID'
  | 'DUPLICATE_QUESTION_CONTENT'
  | 'MATH_FORMAT_INVALID'
  | 'MISSING_EXPLANATION';

export interface QuizSlotAuditIssue {
  code: QuizSlotAuditCode;
  slotIds: string[];
  path?: Array<string | number>;
  message: string;
  repairable: boolean;
}

const questionTextV3 = (question: GeneratedQuestionV3): string => {
  const record = question as Record<string, unknown>;
  if (typeof record.question === 'string') return record.question;
  if (typeof record.mainQuestion === 'string') return record.mainQuestion;
  if (typeof record.sentence === 'string') return record.sentence;
  if (typeof record.text === 'string') return record.text;
  if (Array.isArray(record.riddleLines)) return record.riddleLines.join(' ');
  return question.slotId;
};

const slotIssue = (
  code: QuizSlotAuditCode,
  slotIds: string[],
  message: string,
  path?: Array<string | number>,
): QuizSlotAuditIssue => ({
  code,
  slotIds,
  path,
  message,
  repairable: true,
});

export function auditGeneratedQuizV3(
  quiz: GeneratedQuizV3,
  blueprint: QuizBlueprintV3,
): QuizSlotAuditIssue[] {
  const issues: QuizSlotAuditIssue[] = [];
  if (quiz.promptVersion !== 'ai-blueprint-v3' || quiz.blueprintVersion !== 3) {
    issues.push(slotIssue(
      'ROOT_VERSION_MISMATCH',
      [],
      'Phiên bản prompt hoặc blueprint không khớp V3.',
    ));
  }

  const expectedBySlotId = new Map<string, QuizBlueprintV3['slots'][number]>(
    blueprint.slots.map((slot) => [slot.slotId, slot]),
  );
  const actualBySlotId = new Map<string, GeneratedQuestionV3[]>();
  quiz.questions.forEach((question) => {
    const existing = actualBySlotId.get(question.slotId) ?? [];
    existing.push(question);
    actualBySlotId.set(question.slotId, existing);
  });

  for (const slot of blueprint.slots) {
    const actual = actualBySlotId.get(slot.slotId) ?? [];
    if (actual.length === 0) {
      issues.push(slotIssue('MISSING_SLOT', [slot.slotId], `Thiếu câu cho ${slot.slotId}.`));
      continue;
    }
    if (actual.length > 1) {
      issues.push(slotIssue('DUPLICATE_SLOT', [slot.slotId], `${slot.slotId} xuất hiện nhiều hơn một lần.`));
      continue;
    }

    const question = actual[0];
    if (question.type !== slot.type) {
      issues.push(slotIssue(
        'SLOT_TYPE_MISMATCH',
        [slot.slotId],
        `${slot.slotId} phải là ${slot.type} nhưng AI trả ${question.type}.`,
        ['type'],
      ));
      continue;
    }
    if (question.difficulty !== slot.difficulty) {
      issues.push(slotIssue(
        'SLOT_DIFFICULTY_MISMATCH',
        [slot.slotId],
        `${slot.slotId} phải có mức độ ${slot.difficulty}.`,
        ['difficulty'],
      ));
    }
    if ((slot.subject && question.subject !== slot.subject)
      || (slot.skillCode && question.skillCode !== slot.skillCode)
      || (slot.subskillCode && question.subskillCode !== slot.subskillCode)) {
      issues.push(slotIssue(
        'SLOT_SKILL_MISMATCH',
        [slot.slotId],
        `${slot.slotId} không khớp metadata kỹ năng trong blueprint.`,
        ['skillCode'],
      ));
    }

    const contract = getAiQuestionContract(question.type);
    const schemaResult = contract.schema.safeParse(question);
    if (!schemaResult.success) {
      issues.push(slotIssue(
        'QUESTION_SCHEMA_INVALID',
        [slot.slotId],
        `${slot.slotId} không đúng schema ${slot.type}.`,
      ));
      continue;
    }
    const semanticIssues = validateGeneratedQuestionSemantics(question, slot);
    semanticIssues.forEach((semanticIssue) => {
      issues.push(slotIssue(
        'QUESTION_SEMANTIC_INVALID',
        [slot.slotId],
        semanticIssue.message,
        semanticIssue.path,
      ));
    });
    if (!question.explanation?.trim()) {
      issues.push(slotIssue(
        'MISSING_EXPLANATION',
        [slot.slotId],
        `${slot.slotId} thiếu lời giải.`,
        ['explanation'],
      ));
    }
    const mathIssues = validateQuestionMath(question);
    if (mathIssues.length > 0) {
      issues.push(slotIssue(
        'MATH_FORMAT_INVALID',
        [slot.slotId],
        mathIssues[0].message,
        mathIssues[0].field ? [mathIssues[0].field] : undefined,
      ));
    }
  }

  for (const [slotId] of actualBySlotId) {
    if (!expectedBySlotId.has(slotId)) {
      issues.push(slotIssue('UNEXPECTED_SLOT', [slotId], `Đề chứa slot ngoài blueprint: ${slotId}.`));
    }
  }

  const uniqueQuestions = quiz.questions.filter((question) => (
    expectedBySlotId.has(question.slotId)
    && actualBySlotId.get(question.slotId)?.length === 1
  ));
  for (let leftIndex = 0; leftIndex < uniqueQuestions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < uniqueQuestions.length; rightIndex += 1) {
      if (similarity(
        questionTextV3(uniqueQuestions[leftIndex]),
        questionTextV3(uniqueQuestions[rightIndex]),
      ) >= 0.88) {
        issues.push(slotIssue(
          'DUPLICATE_QUESTION_CONTENT',
          [uniqueQuestions[rightIndex].slotId],
          `${uniqueQuestions[leftIndex].slotId} và ${uniqueQuestions[rightIndex].slotId} có nội dung gần trùng nhau.`,
        ));
      }
    }
  }

  return issues;
}
