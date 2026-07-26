import type { QuestionBlueprintSlot } from '../../../features/quiz-generator/domain/quizBlueprint';
import type { GeneratedQuestionV3 } from '../question-contracts/questionContract.types';
import { getAiQuestionContract } from '../question-contracts/questionContractRegistry';

export function buildQuestionRegenerationPrompt(input: {
  slot: QuestionBlueprintSlot;
  currentQuestion: GeneratedQuestionV3;
  otherQuestionSummaries: Array<{ slotId: string; normalizedPrompt: string }>;
  teacherInstruction?: string;
}): string {
  const contract = getAiQuestionContract(input.slot.type).promptFragment({
    classLevel: '',
    intent: 'PRACTICE',
    sourceMode: 'TOPIC',
    hasImageLibrary: input.slot.imagePolicy === 'required',
  }).replaceAll('"slotId":"slot-1"', '"slotId":"<slotId>"');
  const slotProjection = {
    slotId: input.slot.slotId,
    type: input.slot.type,
    difficulty: input.slot.difficulty,
    objective: input.slot.objective,
    subject: input.slot.subject,
    skillCode: input.slot.skillCode,
    subskillCode: input.slot.subskillCode,
    imagePolicy: input.slot.imagePolicy,
  };

  return [
    'Sinh lại đúng một câu cho slot sau.',
    JSON.stringify(slotProjection),
    'Không được đổi slotId, type hoặc difficulty.',
    contract,
    '[CÂU HIỆN TẠI]',
    JSON.stringify(input.currentQuestion),
    '[CÁC CÂU KHÁC ĐỂ TRÁNH TRÙNG]',
    input.otherQuestionSummaries
      .map((summary) => `${summary.slotId}: ${summary.normalizedPrompt}`)
      .join('\n') || 'Không có.',
    '[YÊU CẦU GIÁO VIÊN]',
    input.teacherInstruction?.trim() || 'Đổi nội dung nhưng giữ nguyên mục tiêu học tập.',
    'Chỉ trả JSON root V3 chứa đúng một câu trong questions.',
  ].join('\n');
}
