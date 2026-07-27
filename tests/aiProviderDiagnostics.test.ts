import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizAiExecutionContext } from '../src/services/ai/aiAction';
import { generateWithGemini } from '../src/services/ai/providers/geminiProvider';
import { generateWithOpenAIResilient } from '../src/services/ai/providers/openaiProvider';
import { generateWithPerplexity } from '../src/services/ai/providers/perplexityProvider';

const requestWorkerAiText = vi.hoisted(() => vi.fn());

vi.mock('../src/services/ai/workerAiClient', () => ({
  requestWorkerAiText,
}));

const execution: QuizAiExecutionContext = {
  action: {
    actionId: 'ai-1234567890abcdefghij',
    workflow: 'QUIZ_CREATE',
  },
  stage: 'GENERATE',
  diagnostics: {
    promptVersion: 'ai-blueprint-v3',
    blueprintVersion: 3,
    slotCount: 13,
  },
};

const providerJson = JSON.stringify({
  promptVersion: 'ai-blueprint-v3',
  blueprintVersion: 3,
  title: 'Đề kiểm thử',
  questions: [],
});

const expectDiagnosticsForwarded = () => {
  expect(requestWorkerAiText).toHaveBeenCalledTimes(1);
  expect(requestWorkerAiText.mock.calls[0][1]?.action).toEqual({
    actionId: execution.action.actionId,
    workflow: 'QUIZ_CREATE',
    stage: 'GENERATE',
    promptVersion: 'ai-blueprint-v3',
    blueprintVersion: 3,
    slotCount: 13,
  });
};

describe('AI provider V3 diagnostics propagation', () => {
  beforeEach(() => {
    requestWorkerAiText.mockReset();
    requestWorkerAiText.mockResolvedValue(providerJson);
  });

  it('forwards diagnostics through the OpenAI-compatible provider', async () => {
    await generateWithOpenAIResilient(
      'prompt',
      '',
      null,
      [],
      'mux',
      undefined,
      execution,
      '[SYSTEM ai-blueprint-v3]',
    );

    expectDiagnosticsForwarded();
  });

  it('forwards diagnostics through the Gemini provider', async () => {
    await generateWithGemini(
      'prompt',
      '',
      null,
      [],
      undefined,
      execution,
      '[SYSTEM ai-blueprint-v3]',
    );

    expectDiagnosticsForwarded();
  });

  it('forwards diagnostics through the Perplexity provider', async () => {
    await generateWithPerplexity(
      'prompt',
      '',
      execution,
      '[SYSTEM ai-blueprint-v3]',
    );

    expectDiagnosticsForwarded();
  });
});
