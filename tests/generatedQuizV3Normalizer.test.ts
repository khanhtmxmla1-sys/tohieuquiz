import { describe, expect, it } from 'vitest';
import { normalizeGeneratedQuizV3Compatibility } from '../src/services/ai/schemas/generatedQuizV3Normalizer';

describe('generated quiz V3 compatibility normalizer', () => {
  it('maps difficultyLevel to difficulty and removes the legacy alias', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      title: 'Đề',
      questions: [{ slotId: 'slot-1', type: 'MCQ', difficultyLevel: 2 }],
    }, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as Record<string, any>;

    expect(normalized.promptVersion).toBe('ai-blueprint-v3');
    expect(normalized.blueprintVersion).toBe(3);
    expect(normalized.questions[0].difficulty).toBe(2);
    expect(normalized.questions[0].difficultyLevel).toBeUndefined();
  });

  it('does not overwrite canonical difficulty when both fields exist', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      title: 'Đề',
      questions: [{
        slotId: 'slot-1',
        type: 'MCQ',
        difficulty: 1,
        difficultyLevel: 3,
      }],
    }, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as Record<string, any>;

    expect(normalized.questions[0].difficulty).toBe(1);
    expect(normalized.questions[0].difficultyLevel).toBeUndefined();
  });

  it('does not infer a missing slotId from array position', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      title: 'Đề',
      questions: [{ type: 'MCQ', difficulty: 2 }],
    }, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as Record<string, any>;

    expect(normalized.questions[0].slotId).toBeUndefined();
  });

  it('leaves the legacy alias untouched when compatibility is disabled', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      title: 'Đề',
      questions: [{ slotId: 'slot-1', type: 'MCQ', difficultyLevel: 2 }],
    }, {
      allowV2DifficultyAlias: false,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as Record<string, any>;

    expect(normalized.questions[0].difficulty).toBeUndefined();
    expect(normalized.questions[0].difficultyLevel).toBe(2);
  });

  it('returns primitives unchanged instead of inventing a quiz object', () => {
    expect(normalizeGeneratedQuizV3Compatibility(null, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    })).toBeNull();
    expect(normalizeGeneratedQuizV3Compatibility('invalid', {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    })).toBe('invalid');
  });
});
