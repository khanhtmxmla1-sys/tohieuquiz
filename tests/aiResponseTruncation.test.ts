import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWorkerAiText } from '../src/services/ai/workerAiClient';

const request = { model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'test' }] };
const truncatedMessage = 'Phản hồi AI bị cắt do giới hạn đầu ra. Hãy thử tạo ít câu hơn trong một lần.';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI response truncation classification', () => {
  it('rejects nonempty OpenAI-compatible output with finish_reason length', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: '{"questions":[' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(requestWorkerAiText(request)).rejects.toThrow(truncatedMessage);
  });

  it('rejects Gemini output with MAX_TOKENS', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(requestWorkerAiText(request)).rejects.toThrow(truncatedMessage);
  });

  it.each([
    [{ choices: [{ finish_reason: 'stop', message: { content: 'complete' } }] }],
    [{ choices: [{ message: { content: 'metadata absent' } }] }],
  ])('does not infer truncation without an explicit provider signal', async (payload) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(requestWorkerAiText(request)).resolves.toMatch(/complete|metadata absent/);
  });

  it('recognizes a terminal SSE length signal after receiving content', async () => {
    const stream = [
      'data: {"choices":[{"delta":{"content":"partial"}}]}',
      '',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    await expect(requestWorkerAiText(request)).rejects.toThrow(truncatedMessage);
  });
});
