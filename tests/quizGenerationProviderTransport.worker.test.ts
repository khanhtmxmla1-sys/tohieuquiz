// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AiPersonalDispatchError } from '../workers/src/services/aiCredentials/dispatch';
import {
  executeQuizAiStage,
  type QuizProviderTransportDependencies,
} from '../workers/src/services/quizGeneration/providerTransport';

const makeEnv = (gatewayFetch: ReturnType<typeof vi.fn>) => ({
  AI_GATEWAY: { fetch: gatewayFetch },
  CLIPROXY_API: 'https://ai-gateway.internal/v1',
  CLIPROXY_TOKEN: 'system-token-secret',
}) as any;

const baseInput = {
  actionId: 'quiz-stage-action-1',
  source: 'system' as const,
  stage: 'GENERATE' as const,
  systemPrompt: 'SYSTEM RULE',
  userPrompt: 'USER RULE',
  responseFormat: { type: 'json_object' as const },
  maxTokens: 4096,
  temperature: 0.2,
};

describe('server quiz provider transport', () => {
  it('uses a server-selected system model and one fixed gateway endpoint', async () => {
    const gatewayFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await executeQuizAiStage(
      makeEnv(gatewayFetch),
      { username: 'teacher-a', role: 'teacher' },
      baseInput,
      { sleep: async () => undefined },
    );

    expect(result).toMatchObject({
      text: '{"ok":true}',
      provider: 'system-gateway',
      model: 'gemini-2.5-flash',
      attempts: 1,
    });
    expect(gatewayFetch).toHaveBeenCalledTimes(1);

    const [url, init] = gatewayFetch.mock.calls[0];
    expect(String(url)).toBe('https://ai-gateway.internal/v1/chat/completions');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer system-token-secret');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'SYSTEM RULE' },
        { role: 'user', content: 'USER RULE' },
      ],
      stream: false,
      response_format: { type: 'json_object' },
    });
  });

  it('retries a transient system 503 without exposing the upstream body', async () => {
    const secret = 'upstream-body-secret';
    const gatewayFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: secret } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await executeQuizAiStage(
      makeEnv(gatewayFetch),
      { username: 'teacher-a', role: 'teacher' },
      baseInput,
      { sleep: async () => undefined },
    );

    expect(result.attempts).toBe(2);
    expect(result.lastTransientError).toMatchObject({ upstreamStatus: 503 });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('classifies explicit system output truncation without retrying it', async () => {
    const gatewayFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: '{"questions":[' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(executeQuizAiStage(
      makeEnv(gatewayFetch),
      { username: 'teacher-a', role: 'teacher' },
      baseInput,
      { sleep: async () => undefined },
    )).rejects.toMatchObject({
      code: 'AI_PROVIDER_OUTPUT_TRUNCATED',
      phase: 'response-content',
    });

    expect(gatewayFetch).toHaveBeenCalledTimes(1);
  });

  it('uses the stored personal credential resolver but never returns the plaintext key', async () => {
    const key = 'personal-key-never-return';
    const resolvePersonalCredential = vi.fn(async () => ({
      provider: 'gemini' as const,
      apiKey: key,
      version: 7,
      model: 'gemini-3.8-flash',
    }));
    const dispatchPersonal = vi.fn(async (input: any) => {
      expect(input.key).toBe(key);
      expect(input.model).toBe('gemini-3.8-flash');
      return { text: '{"questions":[]}' };
    });
    const deps: QuizProviderTransportDependencies = {
      resolvePersonalCredential,
      dispatchPersonal,
      sleep: async () => undefined,
    };

    const result = await executeQuizAiStage(
      makeEnv(vi.fn()),
      { username: 'teacher-a', role: 'teacher' },
      { ...baseInput, source: 'gemini-personal' },
      deps,
    );

    expect(result).toMatchObject({
      text: '{"questions":[]}',
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      attempts: 1,
    });
    expect(JSON.stringify(result)).not.toContain(key);
  });

  it('does not retry a personal 429 quota error', async () => {
    const dispatchPersonal = vi.fn(async () => {
      throw new AiPersonalDispatchError('AI_PROVIDER_QUOTA', {
        phase: 'upstream',
        upstreamStatus: 429,
      });
    });
    const deps: QuizProviderTransportDependencies = {
      resolvePersonalCredential: async () => ({
        provider: 'gemini',
        apiKey: 'hidden-key',
        version: 1,
        model: 'gemini-3.8-flash',
      }),
      dispatchPersonal,
      sleep: async () => undefined,
    };

    await expect(executeQuizAiStage(
      makeEnv(vi.fn()),
      { username: 'teacher-a', role: 'teacher' },
      { ...baseInput, source: 'gemini-personal' },
      deps,
    )).rejects.toMatchObject({
      code: 'AI_PROVIDER_QUOTA',
      upstreamStatus: 429,
    });

    expect(dispatchPersonal).toHaveBeenCalledTimes(1);
  });
});
