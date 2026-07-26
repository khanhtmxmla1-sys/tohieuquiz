import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiAction, createAiActionId } from '../aiAction';
import { requestWorkerAiText } from '../workerAiClient';

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('legacy-token-that-must-be-ignored');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI action metadata', () => {
  it('creates action ids accepted by the Worker policy', () => {
    expect(createAiActionId()).toMatch(/^ai-[a-z0-9-]{20,80}$/i);
    expect(createAiAction('QUIZ_CREATE')).toMatchObject({ workflow: 'QUIZ_CREATE' });
  });
});

describe('requestWorkerAiText', () => {
  it('uses the HttpOnly cookie session and adds safe default metadata', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Nội dung an toàn' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(requestWorkerAiText({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'test' }] }))
      .resolves.toBe('Nội dung an toàn');

    const [url, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toContain('/api/ai/chat');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init?.credentials).toBe('include');
    expect(body._meta).toMatchObject({ workflow: 'GENERIC', stage: 'GENERIC' });
    expect(body._meta.actionId).toMatch(/^ai-[a-z0-9-]{20,80}$/i);
  });

  it('forwards an explicit action id, workflow and stage', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Đề đã tạo' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await requestWorkerAiText(
      { model: 'gemini-2.5-flash', messages: [{}] },
      {
        action: {
          actionId: 'ai-1234567890abcdefghij',
          workflow: 'QUIZ_CREATE',
          stage: 'GENERATE',
        },
      },
    );

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body._meta).toEqual({
      actionId: 'ai-1234567890abcdefghij',
      workflow: 'QUIZ_CREATE',
      stage: 'GENERATE',
    });
  });

  it('forwards safe V3 diagnostics inside internal metadata only', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Đề V3' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await requestWorkerAiText(
      { model: 'gemini-2.5-flash', messages: [{}] },
      {
        action: {
          actionId: 'ai-1234567890abcdefghij',
          workflow: 'QUIZ_CREATE',
          stage: 'GENERATE',
          promptVersion: 'ai-blueprint-v3',
          blueprintVersion: 3,
          slotCount: 13,
        },
      },
    );

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body._meta).toEqual({
      actionId: 'ai-1234567890abcdefghij',
      workflow: 'QUIZ_CREATE',
      stage: 'GENERATE',
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      slotCount: 13,
    });
  });

  it('combines OpenAI-compatible SSE deltas', async () => {
    const stream = [
      'data: {"choices":[{"delta":{"content":"Xin "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"chào"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    await expect(requestWorkerAiText({ model: 'gemini-2.5-flash', messages: [{}] }))
      .resolves.toBe('Xin chào');
  });

  it('aborts the request when the caller cancels it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));
    const controller = new AbortController();

    const pending = requestWorkerAiText(
      { model: 'gemini-2.5-flash', messages: [{}] },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(pending).rejects.toThrow('Đã hủy yêu cầu AI.');
  });
});
