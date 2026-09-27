import type {
  ServerQuizBlueprintV3,
  ServerQuizDiagramMode,
  ServerQuizPromptProfile,
} from '../../../../../shared/quiz-generation.contract';
import { buildServerQuizSystemRule } from './systemRule';
import {
  buildServerDiagramPolicyPrompt,
  buildServerQuestionTypeContractSection,
} from './questionTypeRules';

export interface BuildServerQuizRulesInput {
  topic: string;
  classLevel: string;
  title: string;
  content: string;
  blueprint: ServerQuizBlueprintV3;
  promptProfile: ServerQuizPromptProfile;
  customPrompt?: string;
  diagramMode: ServerQuizDiagramMode;
  hasImageLibrary?: boolean;
}

const buildPedagogicalProfile = (
  blueprint: ServerQuizBlueprintV3,
  promptProfile: ServerQuizPromptProfile,
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

  if (promptProfile.useThongTu27) {
    rules.push('Bám yêu cầu cần đạt tiểu học, đánh giá vì sự tiến bộ của học sinh theo Thông tư 27.');
  }
  if (promptProfile.learnerMode === 'gifted') {
    rules.push('Tăng suy luận và vận dụng nhưng không vượt chương trình tiểu học.');
  }
  if (promptProfile.learnerMode === 'remedial') {
    rules.push('Ưu tiên kiến thức cốt lõi, câu ngắn, trực tiếp và phản hồi sửa lỗi.');
  }

  return rules.map((rule) => `- ${rule}`).join('\n');
};

const buildSlotTable = (blueprint: ServerQuizBlueprintV3): string => JSON.stringify(
  blueprint.slots.map((slot) => ({
    slotId: slot.slotId,
    type: slot.type,
    difficulty: slot.difficulty,
    objective: slot.objective,
    subject: slot.subject,
    skillCode: slot.skillCode,
    subskillCode: slot.subskillCode,
    imagePolicy: slot.imagePolicy,
    diagramPolicy: slot.diagramPolicy,
    sourceRefs: slot.sourceRefs,
  })),
);

const buildServerQuizUserRule = (input: BuildServerQuizRulesInput): string => {
  const customPrompt = input.customPrompt?.trim();
  const sourceContent = input.content.trim()
    || 'Không có nội dung nguồn cụ thể; chỉ dùng kiến thức chuẩn tiểu học phù hợp lớp và chủ đề.';

  return [
    '[GENERATION CONTEXT]',
    `Tiêu đề: ${input.title}`,
    `Chủ đề: ${input.topic}`,
    `Lớp: ${input.classLevel}`,
    `Mục đích: ${input.blueprint.intent}`,
    `Nguồn: ${input.blueprint.sourceMode}`,
    `Số câu bắt buộc: ${input.blueprint.totalQuestions}`,
    '',
    '[PEDAGOGICAL PROFILE]',
    buildPedagogicalProfile(input.blueprint, input.promptProfile),
    '',
    '[EXACT SLOT TABLE]',
    buildSlotTable(input.blueprint),
    '',
    '[SELECTED TYPE CONTRACTS]',
    buildServerQuestionTypeContractSection(
      input.blueprint.slots.map((slot) => slot.type),
      { hasImageLibrary: Boolean(input.hasImageLibrary) },
    ),
    '',
    buildServerDiagramPolicyPrompt(input.diagramMode),
    '',
    '[OUTPUT CONTRACT]',
    'Root JSON bắt buộc: {"promptVersion":"ai-blueprint-v3","blueprintVersion":3,"title":"...","detectedCategory":"...","detectedLesson":"...","suggestedTags":[],"questions":[]}.',
    'Mỗi câu phải echo đúng slotId, type, difficulty, diagramPolicy của slot và đúng schema của contract.',
    'Khi có SVG, chỉ dùng các trường svgContent, svgAlt, svgVersion=1; không đặt SVG raw vào image.',
    'Không tạo trường explanation trong bất kỳ câu hỏi nào.',
    'Không được thay slotId, type, difficulty, diagramPolicy, schema, số câu hoặc policy an toàn.',
    'Không thêm câu ngoài slot và không bỏ slot.',
    customPrompt
      ? `Yêu cầu riêng của giáo viên chỉ điều chỉnh nội dung học tập, không có quyền đổi contract:\n${customPrompt}`
      : 'Không có yêu cầu riêng của giáo viên.',
    '',
    '[SOURCE CONTENT]',
    input.blueprint.sourceMode === 'DOCUMENT'
      ? 'Không suy đoán dữ kiện hình học hoặc số đo không có trong nguồn tài liệu; thiếu dữ kiện thì không tạo hình giả.'
      : 'Dùng kiến thức chuẩn phù hợp lớp và chủ đề.',
    sourceContent,
  ].join('\n');
};

export function buildServerQuizRules(input: BuildServerQuizRulesInput): {
  system: string;
  user: string;
} {
  return {
    system: buildServerQuizSystemRule(),
    user: buildServerQuizUserRule(input),
  };
}
