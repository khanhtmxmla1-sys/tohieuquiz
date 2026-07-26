import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import type { GeneratedQuestionV3 } from '../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import { buildQuestionRegenerationPrompt } from '../src/services/ai/prompts/questionRegenerationPrompt';
import type { QuestionBlueprintSlot } from '../src/features/quiz-generator/domain/quizBlueprint';

const slot: QuestionBlueprintSlot = {
  slotId: 'slot-4',
  ordinal: 4,
  type: QuestionType.MATCHING,
  difficulty: 2,
  objective: 'Nối phân số với cách đọc',
  imagePolicy: 'optional',
  subject: 'math',
  skillCode: 'phan_so',
};

const currentQuestion = {
  ...getAiQuestionContract(slot.type).validFixture,
  slotId: slot.slotId,
  type: slot.type,
  difficulty: slot.difficulty,
  explanation: 'Lời giải hiện tại.',
} as GeneratedQuestionV3;

describe('single question V3 regeneration prompt', () => {
  it('locks the original slot contract', () => {
    const prompt = buildQuestionRegenerationPrompt({
      slot,
      currentQuestion,
      otherQuestionSummaries: [{ slotId: 'slot-1', normalizedPrompt: 'so sánh hai phân số' }],
      teacherInstruction: 'Đổi ngữ cảnh nhưng giữ nguyên kỹ năng.',
    });

    expect(prompt).toContain('"slotId":"slot-4"');
    expect(prompt).toContain('"type":"MATCHING"');
    expect(prompt).toContain('"difficulty":2');
    expect(prompt).toContain('Không được đổi slotId, type hoặc difficulty');
    expect(prompt).toContain('[CONTRACT: MATCHING]');
    expect(prompt).toContain('so sánh hai phân số');
  });
});
