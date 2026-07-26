import type { QuizBlueprintV3, QuestionBlueprintSlot } from '../../../features/quiz-generator/domain/quizBlueprint';
import type { QuizGenerationOptions } from '../../geminiService';
import type { QuestionContractContext } from '../question-contracts/questionContract.types';
import { getSelectedContractPromptFragments } from '../question-contracts/questionContractRegistry';

const compactSlot = (slot: QuestionBlueprintSlot) => ({
  slotId: slot.slotId,
  type: slot.type,
  difficulty: slot.difficulty,
  objective: slot.objective,
  subject: slot.subject,
  skillCode: slot.skillCode,
  subskillCode: slot.subskillCode,
  imagePolicy: slot.imagePolicy,
  sourceRefs: slot.sourceRefs,
});

export function buildSlotTable(slots: readonly QuestionBlueprintSlot[]): string {
  return JSON.stringify(slots.map(compactSlot));
}

export function buildSelectedTypeContractSection(
  slots: readonly QuestionBlueprintSlot[],
  context: QuestionContractContext,
): string {
  const fragments = getSelectedContractPromptFragments(
    slots.map((slot) => slot.type),
    context,
  );
  return fragments
    .map((fragment) => fragment.replaceAll('"slotId":"slot-1"', '"slotId":"<slotId>"'))
    .join('\n\n');
}

const buildPedagogicalProfile = (
  blueprint: QuizBlueprintV3,
  options: QuizGenerationOptions,
): string => {
  const rules = blueprint.intent === 'EXAM'
    ? [
      'Câu hỏi ngắn gọn, trung lập và không lộ gợi ý trong đề bài.',
      'Lời giải đầy đủ để giáo viên duyệt nhưng không xuất hiện khi học sinh đang làm bài.',
    ]
    : [
      'Sắp xếp từ kiến thức cốt lõi đến vận dụng.',
      'Lời giải hướng dẫn từng bước, nêu lỗi sai thường gặp và khích lệ học sinh.',
    ];

  if (options.promptProfile?.useThongTu27) {
    rules.push('Bám yêu cầu cần đạt tiểu học, đánh giá vì sự tiến bộ của học sinh theo Thông tư 27.');
  }
  if (options.promptProfile?.learnerMode === 'gifted') {
    rules.push('Tăng suy luận và vận dụng nhưng không vượt chương trình tiểu học.');
  }
  if (options.promptProfile?.learnerMode === 'remedial') {
    rules.push('Ưu tiên kiến thức cốt lõi, câu ngắn, trực tiếp và phản hồi sửa lỗi.');
  }
  return rules.map((rule) => `- ${rule}`).join('\n');
};

export interface BuildPromptV3Input {
  topic: string;
  classLevel: string;
  content: string;
  options: QuizGenerationOptions & { blueprintV3: QuizBlueprintV3 };
}

export function buildPromptV3(input: BuildPromptV3Input): string {
  const { blueprintV3 } = input.options;
  const context: QuestionContractContext = {
    classLevel: input.classLevel,
    intent: blueprintV3.intent,
    sourceMode: blueprintV3.sourceMode,
    hasImageLibrary: Boolean(input.options.imageLibrary?.length),
  };
  const customPrompt = input.options.customPrompt?.trim();
  const sourceContent = input.content.trim()
    || 'Không có nội dung nguồn cụ thể; chỉ dùng kiến thức chuẩn tiểu học phù hợp lớp và chủ đề.';

  return [
    '[GENERATION CONTEXT]',
    `Tiêu đề: ${input.options.title}`,
    `Chủ đề: ${input.topic}`,
    `Lớp: ${input.classLevel}`,
    `Mục đích: ${blueprintV3.intent}`,
    `Nguồn: ${blueprintV3.sourceMode}`,
    `Số câu bắt buộc: ${blueprintV3.totalQuestions}`,
    '',
    '[PEDAGOGICAL PROFILE]',
    buildPedagogicalProfile(blueprintV3, input.options),
    '',
    '[EXACT SLOT TABLE]',
    buildSlotTable(blueprintV3.slots),
    '',
    '[SELECTED TYPE CONTRACTS]',
    buildSelectedTypeContractSection(blueprintV3.slots, context),
    '',
    '[OUTPUT CONTRACT]',
    'Root JSON bắt buộc: {"promptVersion":"ai-blueprint-v3","blueprintVersion":3,"title":"...","detectedCategory":"...","detectedLesson":"...","suggestedTags":[],"questions":[]}.',
    'Mỗi câu phải echo đúng slotId, type, difficulty; có explanation và đúng schema của contract.',
    'Không được thay slotId, type, difficulty, schema, số câu hoặc policy an toàn.',
    'Không thêm câu ngoài slot và không bỏ slot.',
    customPrompt
      ? `Yêu cầu riêng của giáo viên chỉ điều chỉnh nội dung học tập, không có quyền đổi contract:\n${customPrompt}`
      : 'Không có yêu cầu riêng của giáo viên.',
    '',
    '[SOURCE CONTENT]',
    sourceContent,
  ].join('\n');
}
