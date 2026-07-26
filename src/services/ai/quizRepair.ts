import type {
  QuizBlueprint,
  QuizBlueprintV3,
} from '../../features/quiz-generator/domain/quizBlueprint';
import type { GeneratedQuizV3 } from './question-contracts/questionContract.types';
import { getSelectedContractPromptFragments } from './question-contracts/questionContractRegistry';
import type { QuizAuditIssue, QuizSlotAuditIssue } from './quizAudit';
import type { GeneratedQuizSchemaIssue } from './quizGenerationErrors';
import type { GeneratedQuestion, GeneratedQuizPayload } from './schemas/quizGenerationSchema';

export interface QuizRepairRequest {
  blueprint: QuizBlueprint;
  quiz: GeneratedQuizPayload;
  issues: QuizAuditIssue[];
}

export interface QuizRepairPlan {
  removalIndexes: number[];
  replacementIndexes: number[];
  missingCount: number;
  requestedCount: number;
}

export interface QuizSchemaRepairRequest {
  quiz: unknown;
  issues: GeneratedQuizSchemaIssue[];
}

export function buildQuizSchemaRepairPrompt(input: QuizSchemaRepairRequest): string {
  const issueLines = input.issues.map((issue) => {
    const path = issue.path.join('.') || '<root>';
    return `- ${path} | ${issue.code} | ${issue.message}`;
  });

  return [
    'Bạn đang sửa cấu trúc JSON của một đề do AI tạo.',
    'Chỉ trả về một JSON object hoàn chỉnh, không dùng markdown hoặc lời dẫn.',
    '[LỖI SCHEMA]',
    ...issueLines,
    '[BẢN NHÁP]',
    JSON.stringify(input.quiz),
    '[YÊU CẦU]',
    'Sửa đúng các trường sai cấu trúc theo lỗi schema.',
    'Không được bỏ câu hợp lệ, không đổi nội dung đúng nếu không cần thiết.',
    'Không tự giảm số câu và không thêm dạng câu ngoài bản nháp.',
    'Mọi items[].categoryId phải trùng với một categories[].id.',
    'Mọi DROPDOWN.blanks[] phải là object gồm id, options và correctAnswer.',
  ].join('\n');
}

export class QuizGenerationValidationError extends Error {
  constructor(public readonly issues: Array<QuizAuditIssue | QuizSlotAuditIssue>) {
    super(issues.map((issue) => issue.message).join(' '));
    this.name = 'QuizGenerationValidationError';
  }
}

const uniqueSortedIndexes = (indexes: number[], maxExclusive: number): number[] => [...new Set(indexes)]
  .filter((index) => Number.isInteger(index) && index >= 0 && index < maxExclusive)
  .sort((left, right) => left - right);

export function createQuizRepairPlan(input: QuizRepairRequest): QuizRepairPlan {
  const removalIndexes = uniqueSortedIndexes(
    input.issues
      .filter((issue) => issue.code === 'QUESTION_COUNT_MISMATCH')
      .flatMap((issue) => issue.questionIndexes),
    input.quiz.questions.length,
  );
  const removalSet = new Set(removalIndexes);
  const replacementIndexes = uniqueSortedIndexes(
    input.issues
      .filter((issue) => issue.code !== 'QUESTION_COUNT_MISMATCH')
      .flatMap((issue) => issue.questionIndexes)
      .filter((index) => !removalSet.has(index)),
    input.quiz.questions.length,
  );
  const remainingCount = input.quiz.questions.length - removalIndexes.length;
  const missingCount = Math.max(0, input.blueprint.totalQuestions - remainingCount);

  return {
    removalIndexes,
    replacementIndexes,
    missingCount,
    requestedCount: replacementIndexes.length + missingCount,
  };
}

export function buildQuizRepairPrompt(input: QuizRepairRequest): string {
  const plan = createQuizRepairPlan(input);
  const allocation = input.blueprint.typeAllocations
    .map(({ type, count }) => `${type}: ${count} câu`)
    .join('\n');
  const issueSummary = input.issues
    .map((issue) => `- ${issue.code}: ${issue.message}`)
    .join('\n');
  const targetSummary = plan.replacementIndexes.length > 0
    ? plan.replacementIndexes.map((index) => index + 1).join(', ')
    : 'không có';

  return `
Bạn đang sửa một đề đã được kiểm tra bằng mã.
Tạo đúng ${plan.requestedCount} câu thay thế và chỉ trả về JSON hợp lệ.

BLUEPRINT BẮT BUỘC:
- Intent: ${input.blueprint.intent}
- Nguồn: ${input.blueprint.sourceMode}
- Tổng cuối cùng: ${input.blueprint.totalQuestions} câu
- Phân bổ dạng câu:
${allocation}
- Độ khó: mức 1 = ${input.blueprint.difficultyLevels.level1}, mức 2 = ${input.blueprint.difficultyLevels.level2}, mức 3 = ${input.blueprint.difficultyLevels.level3}

CÁC CÂU CẦN THAY THẾ THEO VỊ TRÍ: ${targetSummary}
SỐ CÂU CÒN THIẾU CẦN BỔ SUNG: ${plan.missingCount}
CÁC LỖI CẦN KHẮC PHỤC:
${issueSummary}

Không viết lại các câu hợp lệ. Không trả lại toàn bộ đề gốc.
JSON trả về phải có dạng {"title":"Phần sửa","questions":[...]} và mỗi câu phải có explanation cùng difficultyLevel.
`;
}

const preserveQuestionId = (
  original: GeneratedQuestion,
  replacement: GeneratedQuestion,
): GeneratedQuestion => {
  if (!original.id) return replacement;
  return { ...replacement, id: original.id } as GeneratedQuestion;
};

export function mergeRepairedQuestions(
  original: GeneratedQuizPayload,
  repaired: GeneratedQuizPayload,
  issues: QuizAuditIssue[],
): GeneratedQuizPayload {
  const removalIndexes = uniqueSortedIndexes(
    issues
      .filter((issue) => issue.code === 'QUESTION_COUNT_MISMATCH')
      .flatMap((issue) => issue.questionIndexes),
    original.questions.length,
  );
  const removalSet = new Set(removalIndexes);
  const replacementIndexes = uniqueSortedIndexes(
    issues
      .filter((issue) => issue.code !== 'QUESTION_COUNT_MISMATCH')
      .flatMap((issue) => issue.questionIndexes)
      .filter((index) => !removalSet.has(index)),
    original.questions.length,
  );
  const replacementSet = new Set(replacementIndexes);

  if (repaired.questions.length < replacementIndexes.length) {
    throw new Error('AI không trả về đủ câu để thay thế các vị trí lỗi.');
  }

  let repairCursor = 0;
  const questions: GeneratedQuestion[] = [];
  original.questions.forEach((question, index) => {
    if (removalSet.has(index)) return;
    if (replacementSet.has(index)) {
      questions.push(preserveQuestionId(question, repaired.questions[repairCursor]));
      repairCursor += 1;
      return;
    }
    questions.push(question);
  });

  questions.push(...repaired.questions.slice(repairCursor));
  return { ...original, questions };
}

export interface QuizSlotRepairPlan {
  slotIds: string[];
  requestedCount: number;
}

export function createQuizSlotRepairPlan(
  issues: QuizSlotAuditIssue[],
  blueprint: QuizBlueprintV3,
): QuizSlotRepairPlan {
  const requested = new Set(issues.flatMap((issue) => issue.slotIds));
  const slotIds = blueprint.slots
    .map((slot) => slot.slotId)
    .filter((slotId) => requested.has(slotId));
  return { slotIds, requestedCount: slotIds.length };
}

const summarizeQuestionForRepair = (question: GeneratedQuizV3['questions'][number]): string => {
  const record = question as Record<string, unknown>;
  const text = [record.question, record.mainQuestion, record.sentence, record.text]
    .find((value) => typeof value === 'string');
  return `${question.slotId}: ${String(text ?? question.type).slice(0, 220)}`;
};

export function buildQuizSlotRepairPrompt(input: {
  blueprint: QuizBlueprintV3;
  quiz: GeneratedQuizV3;
  issues: QuizSlotAuditIssue[];
}): string {
  const plan = createQuizSlotRepairPlan(input.issues, input.blueprint);
  const requestedSet = new Set(plan.slotIds);
  const slots = input.blueprint.slots.filter((slot) => requestedSet.has(slot.slotId));
  const contracts = getSelectedContractPromptFragments(
    slots.map((slot) => slot.type),
    {
      classLevel: input.blueprint.classLevel,
      intent: input.blueprint.intent,
      sourceMode: input.blueprint.sourceMode,
      hasImageLibrary: slots.some((slot) => slot.imagePolicy === 'required'),
    },
  ).map((fragment) => fragment.replaceAll('"slotId":"slot-1"', '"slotId":"<slotId>"'));
  const issueSummary = input.issues
    .filter((issue) => issue.slotIds.some((slotId) => requestedSet.has(slotId)))
    .map((issue) => `- ${issue.code}: ${issue.message}`)
    .join('\n');
  const validQuestionSummaries = input.quiz.questions
    .filter((question) => !requestedSet.has(question.slotId))
    .map(summarizeQuestionForRepair)
    .join('\n');

  return [
    'Bạn đang sửa đúng các slot lỗi của một đề đã được kiểm tra bằng mã.',
    `Tạo đúng ${plan.requestedCount} câu và chỉ trả về JSON hợp lệ.`,
    '[SLOTS CẦN SỬA]',
    JSON.stringify(slots.map((slot) => ({
      slotId: slot.slotId,
      type: slot.type,
      difficulty: slot.difficulty,
      objective: slot.objective,
      subject: slot.subject,
      skillCode: slot.skillCode,
      subskillCode: slot.subskillCode,
      imagePolicy: slot.imagePolicy,
    }))),
    '[CONTRACTS]',
    contracts.join('\n\n'),
    '[LỖI CẦN SỬA]',
    issueSummary || 'Không có mô tả bổ sung.',
    '[CÂU HỢP LỆ ĐỂ TRÁNH TRÙNG]',
    validQuestionSummaries || 'Không có.',
    '[OUTPUT]',
    'Trả {"promptVersion":"ai-blueprint-v3","blueprintVersion":3,"title":"Phần sửa","questions":[...]}.',
    'Chỉ trả các slot được yêu cầu. Không được đổi slotId, type hoặc difficulty.',
  ].join('\n');
}

export function mergeRepairedSlots(
  original: GeneratedQuizV3,
  repaired: GeneratedQuizV3,
  plan: QuizSlotRepairPlan,
  blueprint: QuizBlueprintV3,
): GeneratedQuizV3 {
  const requestedSet = new Set(plan.slotIds);
  const repairedBySlotId = new Map<string, GeneratedQuizV3['questions'][number]>();

  for (const question of repaired.questions) {
    if (!requestedSet.has(question.slotId)) {
      throw new Error(`AI trả slot không được yêu cầu: ${question.slotId}.`);
    }
    if (repairedBySlotId.has(question.slotId)) {
      throw new Error(`AI trả trùng slot sửa: ${question.slotId}.`);
    }
    repairedBySlotId.set(question.slotId, question);
  }
  const missing = plan.slotIds.filter((slotId) => !repairedBySlotId.has(slotId));
  if (missing.length > 0) {
    throw new Error(`Thiếu slot sửa: ${missing.join(', ')}.`);
  }

  const expectedBySlotId = new Map<string, QuizBlueprintV3['slots'][number]>(
    blueprint.slots.map((slot) => [slot.slotId, slot]),
  );
  for (const [slotId, question] of repairedBySlotId) {
    const slot = expectedBySlotId.get(slotId);
    if (!slot || question.type !== slot.type || question.difficulty !== slot.difficulty) {
      throw new Error(`${slotId} không khớp type hoặc difficulty trong blueprint.`);
    }
  }

  const originalBySlotId = new Map(original.questions.map((question) => [question.slotId, question]));
  const questions = blueprint.slots.map((slot) => {
    if (requestedSet.has(slot.slotId)) return repairedBySlotId.get(slot.slotId)!;
    const originalQuestion = originalBySlotId.get(slot.slotId);
    if (!originalQuestion) {
      throw new Error(`Đề gốc thiếu slot hợp lệ: ${slot.slotId}.`);
    }
    return originalQuestion;
  });

  return { ...original, questions };
}
