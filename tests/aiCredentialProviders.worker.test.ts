// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiCredentialProviderError,
  testProviderCredential,
} from '../workers/src/services/aiCredentials/providerClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('teacher AI credential provider client', () => {
  it.each([
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-3.8-flash'],
    ['deepseek', 'https://api.deepseek.com/chat/completions', 'deepseek-flash'],
  ] as const)('tests %s credentials only against its fixed endpoint and server model', async (provider, url, model) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await testProviderCredential(provider, 'canary-provider-key-1234567890');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toBe(url);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer canary-provider-key-1234567890');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      max_tokens: 16,
      stream: false,
    });
    expect(init?.redirect).toBe('error');
  });

  it.each([
    [401, 'AI_KEY_INVALID'],
    [429, 'AI_PROVIDER_QUOTA'],
    [403, 'AI_PROVIDER_ACCOUNT_REQUIRED'],
    [503, 'AI_PROVIDER_UNAVAILABLE'],
  ] as const)('maps upstream %s to a stable public code without reflecting the provider body', async (status, code) => {
    const canary = 'canary-secret-never-reflect';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: { message: `upstream says ${canary}` } }),
      { status, headers: { 'Content-Type': 'application/json' } },
    ));

    const error = await testProviderCredential('gemini', canary).catch((value) => value);
    expect(error).toBeInstanceOf(AiCredentialProviderError);
    expect(error.code).toBe(code);
    expect(String(error.message)).not.toContain(canary);
  });

  it('recognizes Gemini API_KEY_INVALID responses without exposing the provider message', async () => {
    const canary = 'gemini-secret-never-reflect';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 400,
        message: `API key not valid: ${canary}`,
        status: 'INVALID_ARGUMENT',
        details: [{
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'API_KEY_INVALID',
          domain: 'googleapis.com',
        }],
      },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    const error = await testProviderCredential('gemini', canary).catch((value) => value);

    expect(error).toBeInstanceOf(AiCredentialProviderError);
    expect(error.code).toBe('AI_KEY_INVALID');
    expect(String(error.message)).not.toContain(canary);
  });

  it.each([
    ['gemini', 400, {
      error: {
        code: 400,
        status: 'FAILED_PRECONDITION',
        message: 'Billing or account setup is required.',
      },
    }],
    ['deepseek', 402, {
      error: {
        code: 'insufficient_balance',
        message: 'Insufficient balance.',
      },
    }],
  ] as const)('maps %s account prerequisites to a stable account-required code', async (provider, status, body) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json' } },
    ));

    const error = await testProviderCredential(provider, 'canary-provider-key-1234567890')
      .catch((value) => value);

    expect(error).toBeInstanceOf(AiCredentialProviderError);
    expect(error.code).toBe('AI_PROVIDER_ACCOUNT_REQUIRED');
  });

  it('keeps an unknown Gemini bad request distinct from provider downtime', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'Unknown server-controlled request field.',
      },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    const error = await testProviderCredential('gemini', 'canary-provider-key-1234567890')
      .catch((value) => value);

    expect(error).toBeInstanceOf(AiCredentialProviderError);
    expect(error.code).toBe('AI_PROVIDER_REQUEST_REJECTED');
  });

  it('maps a provider timeout/abort to AI_PROVIDER_TIMEOUT without retrying', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));

    const promise = testProviderCredential('deepseek', 'canary-provider-key-1234567890')
      .then(() => null, (value) => value);
    await vi.advanceTimersByTimeAsync(15_001);

    const error = await promise;
    expect(error).toBeInstanceOf(AiCredentialProviderError);
    expect(error.code).toBe('AI_PROVIDER_TIMEOUT');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
