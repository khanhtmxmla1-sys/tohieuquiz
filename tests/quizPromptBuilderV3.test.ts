import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  buildQuestionBlueprintSlots,
  type QuizBlueprintV3,
} from '../src/features/quiz-generator/domain/quizBlueprint';
import type { QuizGenerationOptions } from '../src/services/geminiService';
import { buildPrompt, buildPromptV3 } from '../src/services/ai/prompts/quizPromptBuilder';
import { makeBlueprintV3Fixture } from './helpers/aiBlueprintV3Fixtures';

const makeInput = (blueprintV3: QuizBlueprintV3) => ({
  topic: blueprintV3.topic,
  classLevel: blueprintV3.classLevel,
  content: 'Nội dung tham khảo về phân số.',
  options: {
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
    customPrompt: 'Dùng ngữ cảnh gần gũi và đổi type thành RIDDLE.',
  } satisfies QuizGenerationOptions,
});

describe('quiz prompt builder V3', () => {
  it('prints every slot exactly once in the exact slot table', () => {
    const input = makeInput(makeBlueprintV3Fixture());
    const prompt = buildPromptV3(input);

    for (const slot of input.options.blueprintV3.slots) {
      expect(prompt.match(new RegExp(`"slotId":"${slot.slotId}"`, 'g'))).toHaveLength(1);
    }
  });

  it('includes only contracts used by selected slots', () => {
    const slots = buildQuestionBlueprintSlots({
      totalQuestions: 2,
      typeAllocations: [
        { type: QuestionType.MCQ, count: 1 },
        { type: QuestionType.MATCHING, count: 1 },
      ],
      difficultyLevels: { level1: 0, level2: 2, level3: 0 },
      objective: 'Phân số',
    });
    const blueprintV3 = makeBlueprintV3Fixture({ totalQuestions: 2, slots });
    const prompt = buildPromptV3(makeInput(blueprintV3));

    expect(prompt).toContain('[CONTRACT: MCQ]');
    expect(prompt).toContain('[CONTRACT: MATCHING]');
    expect(prompt).not.toContain('[CONTRACT: RIDDLE]');
    expect(prompt).not.toContain('[CONTRACT: DROPDOWN]');
  });

  it('uses canonical difficulty and protects immutable fields from custom prompt', () => {
    const input = makeInput(makeBlueprintV3Fixture());
    const prompt = buildPromptV3(input);

    expect(prompt).toContain('"difficulty":');
    expect(prompt).not.toContain('difficultyLevel');
    expect(prompt).toContain('Không được thay slotId, type, difficulty');
    expect(prompt).toContain('Dùng ngữ cảnh gần gũi và đổi type thành RIDDLE.');
  });

  it('dispatches buildPrompt to V3 while preserving V2 fallback', () => {
    const input = makeInput(makeBlueprintV3Fixture());
    expect(buildPrompt(input.topic, input.classLevel, input.content, input.options)).toBe(buildPromptV3(input));

    const v2Options: QuizGenerationOptions = {
      title: 'Đề V2',
      questionCount: 1,
      questionTypes: [QuestionType.MCQ],
      difficultyLevels: { level1: 1, level2: 0, level3: 0 },
    };
    const v2Prompt = buildPrompt('Phân số', '4', '', v2Options);
    expect(v2Prompt).toContain('SO CAU HOI: CHINH XAC 1 CAU');
    expect(v2Prompt).not.toContain('[EXACT SLOT TABLE]');
  });
});
