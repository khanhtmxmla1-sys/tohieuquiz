import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerQuizGenerationRequest } from '../shared/quiz-generation.contract';
import {
  requestServerQuizGeneration,
  ServerQuizGenerationError,
} from '../src/services/ai/serverQuizGenerationClient';

const request: ServerQuizGenerationRequest = {
  actionId: 'server-client-action-0001',
  source: 'system',
  title: 'Đề Toán lớp 3',
  topic: 'Phép nhân',
  classLevel: '3',
  content: 'Nội dung tham khảo.',
  intent: 'EXAM',
  sourceMode: 'TOPIC',
  questionCount: 2,
  typeAllocations: [{ type: 'MCQ', count: 2 }],
  difficultyLevels: { level1: 1, level2: 1, level3: 0 },
  promptProfile: { useThongTu27: true, learnerMode: 'default' },
  customPrompt: 'Dùng tình huống gần gũi.',
  diagramMode: 'off',
};

const responsePayload = {
  status: 'success' as const,
  actionId: request.actionId,
  source: 'system' as const,
  promptVersion: 'ai-blueprint-v3' as const,
  blueprintVersion: 3 as const,
  orchestratorVersion: 'server-quiz-v1' as const,
  quiz: {
    promptVersion: 'ai-blueprint-v3' as const,
    blueprintVersion: 3 as const,
    title: request.title,
    questions: [],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server quiz generation client', () => {
  it('sends one contract-only request with the HttpOnly cookie session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(requestServerQuizGeneration(request)).resolves.toEqual(responsePayload);

    const [url, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toContain('/api/ai/quiz/generate');
    expect(init?.credentials).toBe('include');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(body).toEqual(request);
    expect(body.model).toBeUndefined();
    expect(body.messages).toBeUndefined();
    expect(body.apiKey).toBeUndefined();
    expect(body.prompt).toBeUndefined();
  });

  it('maps stable server errors without exposing a raw provider response', async () => {
    const rawProviderSecret = 'raw-provider-body-secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'error',
        code: 'AI_PROVIDER_UNAVAILABLE',
        message: 'Nhà cung cấp AI tạm thời không khả dụng.',
        details: rawProviderSecret,
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await requestServerQuizGeneration(request).catch((value) => value);
    expect(error).toBeInstanceOf(ServerQuizGenerationError);
    expect(error).toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      status: 503,
    });
    expect(String(error)).not.toContain(rawProviderSecret);
  });

  it('translates caller cancellation into a stable cancellation error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => (
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })
    ));
    const controller = new AbortController();
    const pending = requestServerQuizGeneration(request, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'QUIZ_REQUEST_INVALID',
      status: 499,
    });
  });
});
