// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ServerQuizBlueprintV3 } from '../shared/quiz-generation.contract';
import { makeBlueprintV3Fixture, makeGeneratedQuizV3Fixture } from './helpers/aiBlueprintV3Fixtures';
import {
  runServerQuizQualityPipeline,
  type ServerQuizQualityPipelineDependencies,
} from '../workers/src/services/quizGeneration/qualityPipeline';

const owner = { username: 'teacher-a', role: 'teacher' as const };
const env = {} as any;

const asServerBlueprint = (blueprint: ReturnType<typeof makeBlueprintV3Fixture>) => (
  blueprint as unknown as ServerQuizBlueprintV3
);

const makeInput = () => {
  const blueprint = makeBlueprintV3Fixture();
  const quiz = makeGeneratedQuizV3Fixture(blueprint);
  return {
    blueprint,
    quiz,
    input: {
      env,
      owner,
      actionId: 'quality-action-1',
      source: 'system' as const,
      blueprint: asServerBlueprint(blueprint),
      draftText: JSON.stringify(quiz),
      rules: {
        system: 'SYSTEM RULE',
        user: 'USER RULE',
      },
    },
  };
};

describe('server quiz quality pipeline', () => {
  it('accepts a valid draft without repair and performs one best-effort review', async () => {
    const { quiz, input } = makeInput();
    const stages: string[] = [];
    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => {
      stages.push(stageInput.stage);
      return {
        text: JSON.stringify(quiz),
        provider: 'system-gateway' as const,
        model: 'gemini-2.5-flash',
        attempts: 1,
      };
    });

    const result = await runServerQuizQualityPipeline(input, { executeStage });

    expect(result).toEqual(quiz);
    expect(stages).toEqual(['REVIEW']);
  });

  it('repairs only the affected slot and preserves valid slots', async () => {
    const { blueprint, quiz, input } = makeInput();
    const brokenQuiz = structuredClone(quiz);
    brokenQuiz.questions[0].difficulty = brokenQuiz.questions[0].difficulty === 1 ? 2 : 1;
    input.draftText = JSON.stringify(brokenQuiz);

    const repairedQuestion = {
      ...quiz.questions[0],
      question: 'Câu đã sửa đúng theo slot.',
    };
    const repairedPayload = {
      promptVersion: 'ai-blueprint-v3' as const,
      blueprintVersion: 3 as const,
      title: 'Phần sửa',
      questions: [repairedQuestion],
    };

    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => {
      if (stageInput.stage === 'REPAIR') {
        return {
          text: JSON.stringify(repairedPayload),
          provider: 'system-gateway' as const,
          model: 'gemini-2.5-flash',
          attempts: 1,
        };
      }
      return {
        text: JSON.stringify({
          ...quiz,
          questions: [
            repairedQuestion,
            ...quiz.questions.slice(1),
          ],
        }),
        provider: 'system-gateway' as const,
        model: 'gemini-2.5-flash',
        attempts: 1,
      };
    });

    const result = await runServerQuizQualityPipeline(input, { executeStage });

    expect(executeStage.mock.calls.map((call) => call[2].stage)).toEqual(['REPAIR', 'REVIEW']);
    expect(result.questions[0]).toMatchObject({
      slotId: blueprint.slots[0].slotId,
      question: 'Câu đã sửa đúng theo slot.',
    });
    expect(result.questions.slice(1)).toEqual(quiz.questions.slice(1));
  });

  it('repairs invalid draft JSON once before running the reviewer', async () => {
    const { quiz, input } = makeInput();
    input.draftText = '{not-json';
    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => ({
      text: JSON.stringify(quiz),
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: 1,
    }));

    const result = await runServerQuizQualityPipeline(input, { executeStage });

    expect(result).toEqual(quiz);
    expect(executeStage.mock.calls.map((call) => call[2].stage)).toEqual(['REPAIR', 'REVIEW']);
    expect(executeStage.mock.calls[0][2].userPrompt).toContain('invalid_json');
  });

  it('does not call AI repair for a non-repairable audit issue', async () => {
    const { input } = makeInput();
    const executeStage = vi.fn();
    const audit = vi.fn(() => [{
      code: 'MATH_FORMAT_INVALID',
      slotIds: ['slot-1'],
      message: 'Lỗi không được tự sửa.',
      repairable: false,
    }]);

    await expect(runServerQuizQualityPipeline(input, {
      executeStage,
      audit: audit as ServerQuizQualityPipelineDependencies['audit'],
    })).rejects.toMatchObject({
      name: 'QuizGenerationValidationError',
    });

    expect(executeStage).not.toHaveBeenCalled();
  });

  it('ignores an invalid reviewer response and returns the already-valid draft', async () => {
    const { quiz, input } = makeInput();
    const executeStage = vi.fn(async () => ({
      text: 'not-json',
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: 1,
    }));

    const result = await runServerQuizQualityPipeline(input, { executeStage });

    expect(result).toEqual(quiz);
    expect(executeStage).toHaveBeenCalledTimes(1);
  });

  it('rejects reviewer structural changes and keeps the validated draft', async () => {
    const { quiz, input } = makeInput();
    const changed = structuredClone(quiz);
    changed.questions[0].slotId = 'slot-999';

    const executeStage = vi.fn(async () => ({
      text: JSON.stringify(changed),
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: 1,
    }));

    const result = await runServerQuizQualityPipeline(input, { executeStage });

    expect(result).toEqual(quiz);
  });

  it('does not swallow an abort raised during best-effort review', async () => {
    const { input } = makeInput();
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const executeStage = vi.fn(async () => {
      throw abort;
    });

    await expect(runServerQuizQualityPipeline(input, { executeStage })).rejects.toBe(abort);
  });
});
