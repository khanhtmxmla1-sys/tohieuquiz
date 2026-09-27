import { describe, expect, it } from 'vitest';
import { makeBlueprintV3Fixture } from './helpers/aiBlueprintV3Fixtures';
import type { QuizGenerationOptions } from '../src/services/geminiService';
import { buildPromptV3 } from '../src/services/ai/prompts/quizPromptBuilder';
import { buildGeneratorSystemPrompt } from '../src/services/ai/prompts/systemPromptBuilder';
import { buildServerQuizRules } from '../workers/src/services/quizGeneration/rules/quizRuleEngine';

const makeLegacyInput = () => {
  const blueprintV3 = makeBlueprintV3Fixture();
  const options = {
    title: 'Đề V3',
    questionCount: blueprintV3.totalQuestions,
    questionTypes: [...new Set(blueprintV3.slots.map((slot) => slot.type))],
    difficultyLevels: {
      level1: blueprintV3.slots.filter((slot) => slot.difficulty === 1).length,
      level2: blueprintV3.slots.filter((slot) => slot.difficulty === 2).length,
      level3: blueprintV3.slots.filter((slot) => slot.difficulty === 3).length,
    },
    promptVersion: 'ai-blueprint-v3' as const,
    blueprintV3,
    diagramMode: 'off' as const,
    customPrompt: 'Dùng ngữ cảnh gần gũi.',
    promptProfile: {
      useThongTu27: true,
      learnerMode: 'default' as const,
    },
  } satisfies QuizGenerationOptions;

  return {
    topic: blueprintV3.topic,
    classLevel: blueprintV3.classLevel,
    content: 'Nội dung tham khảo về phân số.',
    options,
  };
};

describe('server-owned quiz ruler V1', () => {
  it('preserves the existing V3 user-prompt contract for a representative quiz', () => {
    const legacy = makeLegacyInput();
    const legacyPrompt = buildPromptV3(legacy);

    const server = buildServerQuizRules({
      topic: legacy.topic,
      classLevel: legacy.classLevel,
      title: legacy.options.title,
      content: legacy.content,
      blueprint: legacy.options.blueprintV3,
      promptProfile: legacy.options.promptProfile!,
      customPrompt: legacy.options.customPrompt,
      diagramMode: legacy.options.diagramMode!,
    });

    expect(server.user).toBe(legacyPrompt);
  });

  it('keeps core system constraints without provider-specific behavior', () => {
    const legacySystem = buildGeneratorSystemPrompt({
      provider: 'gemini',
      supportsRetrievalContext: false,
      supportsImages: false,
    }, 'ai-blueprint-v3');

    const server = buildServerQuizRules({
      topic: 'Phân số',
      classLevel: '4',
      title: 'Đề V3',
      content: '',
      blueprint: makeBlueprintV3Fixture(),
      promptProfile: { useThongTu27: false, learnerMode: 'default' },
      diagramMode: 'off',
    });

    for (const invariant of [
      'Chỉ trả về một JSON object hợp lệ',
      'Không trả về thought_process',
      'Không được đổi slotId, type hoặc difficulty',
      'Không được tuyên bố đã tìm kiếm hoặc kiểm chứng nguồn bên ngoài',
    ]) {
      expect(legacySystem).toContain(invariant);
      expect(server.system).toContain(invariant);
    }

    expect(server.system).not.toMatch(/Provider:/);
    expect(server.system).not.toMatch(/gemini|deepseek/i);
  });

  it('includes only selected question-type contracts and exact slots', () => {
    const blueprint = makeBlueprintV3Fixture();
    const server = buildServerQuizRules({
      topic: blueprint.topic,
      classLevel: blueprint.classLevel,
      title: 'Đề V3',
      content: '',
      blueprint,
      promptProfile: { useThongTu27: false, learnerMode: 'gifted' },
      diagramMode: 'off',
    });

    expect(server.user).toContain('[CONTRACT: MCQ]');
    expect(server.user).toContain('[CONTRACT: MATCHING]');
    expect(server.user).toContain('[CONTRACT: SHORT_ANSWER]');
    expect(server.user).not.toContain('[CONTRACT: RIDDLE]');

    for (const slot of blueprint.slots) {
      expect(server.user.match(new RegExp(`"slotId":"${slot.slotId}"`, 'g'))).toHaveLength(1);
    }
  });
});
