import { describe, expect, it } from 'vitest';
import {
  buildReviewerSystemPromptV3,
  buildReviewerUserPromptV3,
} from '../src/services/ai/prompts/reviewerPromptBuilder';
import {
  makeBlueprintV3Fixture,
  makeGeneratedQuizV3Fixture,
} from './helpers/aiBlueprintV3Fixtures';

describe('V3 reviewer prompt', () => {
  it('forbids changing immutable slot fields and visible reasoning', () => {
    const prompt = buildReviewerSystemPromptV3();

    expect(prompt).toContain('Không được đổi slotId');
    expect(prompt).toContain('Không được đổi type');
    expect(prompt).toContain('Không được đổi difficulty');
    expect(prompt).toContain('Chỉ trả về JSON');
    expect(prompt).not.toContain('thought_process');
  });

  it('includes only the blueprint projection and current quiz', () => {
    const blueprint = makeBlueprintV3Fixture();
    const quiz = makeGeneratedQuizV3Fixture(blueprint);
    const prompt = buildReviewerUserPromptV3({ blueprint, quiz });

    expect(prompt).toContain('"slotId":"slot-1"');
    expect(prompt).toContain('"promptVersion":"ai-blueprint-v3"');
    expect(prompt).toContain('Giữ nguyên số lượng và cấu trúc câu hỏi');
  });
});
