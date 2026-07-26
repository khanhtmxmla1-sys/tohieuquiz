import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { buildQuizGenerationOptions } from '../src/features/quiz-generator/domain/buildQuizGenerationRequest';

const input = {
  title: 'Đề phân số',
  topic: 'Phân số',
  classLevel: '4',
  questionCount: 4,
  questionTypes: [QuestionType.MCQ, QuestionType.MATCHING],
  typeAllocations: [
    { type: QuestionType.MCQ, count: 2 },
    { type: QuestionType.MATCHING, count: 2 },
  ],
  difficultyLevels: { level1: 1, level2: 2, level3: 1 },
  promptProfile: { useThongTu27: true, learnerMode: 'default' as const },
  imageLibrary: [],
  customPrompt: '',
  quizMode: 'practice' as const,
  intent: 'PRACTICE' as const,
  sourceMode: 'TOPIC' as const,
  subject: 'math' as const,
  skillCode: 'phan_so',
};

describe('buildQuizGenerationOptions V3 adapter', () => {
  it('builds V3 slots from the existing form allocations', () => {
    const options = buildQuizGenerationOptions(input, { enableBlueprintV3: true });

    expect(options.promptVersion).toBe('ai-blueprint-v3');
    expect(options.blueprintV3?.version).toBe(3);
    expect(options.blueprintV3?.topic).toBe('Phân số');
    expect(options.blueprintV3?.classLevel).toBe('4');
    expect(options.blueprintV3?.slots).toHaveLength(4);
    expect(options.blueprintV3?.slots.every((slot) => slot.skillCode === 'phan_so')).toBe(true);
    expect(options.blueprint).toBeDefined();
  });

  it('keeps V2-only output when V3 is disabled', () => {
    const options = buildQuizGenerationOptions(input, { enableBlueprintV3: false });

    expect(options.blueprint).toBeDefined();
    expect(options.blueprintV3).toBeUndefined();
    expect(options.promptVersion).toBeUndefined();
  });

  it('keeps selected OCR page markers as source references', () => {
    const options = buildQuizGenerationOptions({
      ...input,
      sourceMode: 'DOCUMENT',
      quizMode: 'pdf',
      sourceRefs: ['page-2', 'page-4'],
    }, { enableBlueprintV3: true });

    expect(options.blueprintV3?.sourceMode).toBe('DOCUMENT');
    expect(options.blueprintV3?.slots[0].sourceRefs).toEqual(['page-2', 'page-4']);
  });
});
