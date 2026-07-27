import { describe, expect, it, vi } from 'vitest';
import worker, {
  handleAiGatewayRequest,
  type Env,
} from '../workers/ai-gateway/src/index';

const env: Env = {
  AI_ORIGIN: { fetch: vi.fn() },
  AI_GATEWAY_TOKEN: 'new-primary-token',
  UPSTREAM_API_TOKEN: 'upstream-token',
  UPSTREAM_BASE_URL: 'http://ai.thitong.site',
  ALLOWED_ORIGINS: 'https://www.thtohieu.com,https://app.thtohieu.com',
  MAX_REQUEST_BODY_BYTES: '1024',
};

const request = (
  path: string,
  init: RequestInit = {},
): Request => new Request(`https://ai.thtohieu.com${path}`, init);

describe('AI gateway Worker', () => {
  it('does not expose routes outside /v1', async () => {
    const response = await handleAiGatewayRequest(request('/'), env, vi.fn());
    expect(response.status).toBe(404);
  });

  it('rejects missing and legacy tokens before calling upstream', async () => {
    const upstreamFetch = vi.fn();
    const missing = await handleAiGatewayRequest(request('/v1/models'), env, upstreamFetch);
    const legacy = await handleAiGatewayRequest(request('/v1/models', {
      headers: { Authorization: 'Bearer legacy-token' },
    }), env, upstreamFetch);

    expect(missing.status).toBe(401);
    expect(legacy.status).toBe(401);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('proxies path and query while replacing the upstream token', async () => {
    const upstreamFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://ai.thitong.site/v1/models?provider=gemini');
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer upstream-token');
      expect(headers.get('CF-Connecting-IP')).toBeNull();
      return new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const response = await handleAiGatewayRequest(request('/v1/models?provider=gemini', {
      headers: {
        Authorization: 'Bearer new-primary-token',
        'CF-Connecting-IP': '203.0.113.10',
      },
    }), env, upstreamFetch as typeof fetch);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: 'gemini-2.5-flash' }] });
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it('uses the VPC service binding instead of global fetch', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('public fetch must not run'));
    const vpcFetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://ai.thitong.site/v1/models');
      return new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const response = await worker.fetch(request('/v1/models', {
      headers: { Authorization: 'Bearer new-primary-token' },
    }), {
      ...env,
      AI_ORIGIN: { fetch: vpcFetch },
    });

    expect(response.status).toBe(200);
    expect(vpcFetch).toHaveBeenCalledOnce();
    expect(globalFetch).not.toHaveBeenCalled();
    globalFetch.mockRestore();
  });

  it('passes POST and streaming responses through without buffering', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'));
        controller.close();
      },
    });
    const upstreamFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(ArrayBuffer);
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const response = await handleAiGatewayRequest(request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer new-primary-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gemini-2.5-flash', stream: true }),
    }), env, upstreamFetch as typeof fetch);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await response.text()).toContain('"content":"OK"');
  });

  it('retries one transient tunnel failure and preserves the POST body', async () => {
    const bodies: string[] = [];
    const upstreamFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(ArrayBuffer);
      bodies.push(new TextDecoder().decode(init?.body as ArrayBuffer));
      if (bodies.length === 1) return new Response('temporary tunnel error', { status: 522 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const response = await handleAiGatewayRequest(request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer new-primary-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'test' }] }),
    }), env, upstreamFetch as typeof fetch);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-AI-Gateway-Attempts')).toBe('2');
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
    expect(bodies[0]).toBe(bodies[1]);
  });

  it('handles approved CORS preflight and rejects unknown origins', async () => {
    const approved = await handleAiGatewayRequest(request('/v1/chat/completions', {
      method: 'OPTIONS',
      headers: { Origin: 'https://www.thtohieu.com' },
    }), env, vi.fn());
    const rejected = await handleAiGatewayRequest(request('/v1/models', {
      headers: {
        Origin: 'https://evil.example',
        Authorization: 'Bearer new-primary-token',
      },
    }), env, vi.fn());

    expect(approved.status).toBe(204);
    expect(approved.headers.get('Access-Control-Allow-Origin')).toBe('https://www.thtohieu.com');
    expect(rejected.status).toBe(403);
  });

  it('rejects oversized bodies and converts upstream failures to 502', async () => {
    const oversized = await handleAiGatewayRequest(request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer new-primary-token',
        'Content-Length': '2048',
      },
      body: 'x',
    }), env, vi.fn());
    const upstreamFetch = vi.fn(async () => { throw new Error('offline'); });
    const unavailable = await handleAiGatewayRequest(request('/v1/models', {
      headers: { Authorization: 'Bearer new-primary-token' },
    }), env, upstreamFetch as typeof fetch);

    expect(oversized.status).toBe(413);
    expect(unavailable.status).toBe(502);
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
  });
});
