import type { QuizBlueprintV3 } from '../../../features/quiz-generator/domain/quizBlueprint';
import type { GeneratedQuizV3 } from '../question-contracts/questionContract.types';

export function buildReviewerSystemPromptV3(): string {
  return [
    'Bạn là chuyên gia kiểm định đề tiểu học Việt Nam.',
    'Kiểm tra và sửa lỗi nội dung, chính tả, phép toán, LaTeX và độ phù hợp lứa tuổi.',
    'Không được đổi slotId.',
    'Không được đổi type.',
    'Không được đổi difficulty.',
    'Không được thêm, xóa hoặc sắp xếp lại câu hỏi.',
    'Chỉ trả về JSON hợp lệ, không giải thích và không xuất suy luận nội bộ.',
  ].join('\n');
}

export function buildReviewerUserPromptV3(input: {
  blueprint: QuizBlueprintV3;
  quiz: GeneratedQuizV3;
}): string {
  const slotProjection = input.blueprint.slots.map((slot) => ({
    slotId: slot.slotId,
    type: slot.type,
    difficulty: slot.difficulty,
    objective: slot.objective,
    imagePolicy: slot.imagePolicy,
  }));
  return [
    'Giữ nguyên số lượng và cấu trúc câu hỏi. Chỉ sửa nội dung bên trong contract.',
    `BLUEPRINT=${JSON.stringify({
      version: input.blueprint.version,
      totalQuestions: input.blueprint.totalQuestions,
      slots: slotProjection,
    })}`,
    `QUIZ=${JSON.stringify(input.quiz)}`,
  ].join('\n');
}
