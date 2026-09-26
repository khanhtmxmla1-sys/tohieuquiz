// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findApiAuthorizationPolicy } from '../workers/src/middleware/auth';
import {
  decryptCredential,
  encryptCredential,
} from '../workers/src/services/aiCredentials/crypto';
import {
  AiPersonalDispatchError,
  dispatchPersonalAi,
} from '../workers/src/services/aiCredentials/dispatch';

const keyring = JSON.stringify({
  activeKeyId: 'security-v1',
  keys: {
    'security-v1': Buffer.alloc(32, 17).toString('base64'),
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('teacher AI credentials security contract', () => {
  it('declares the credential keyring as a required Worker secret', () => {
    const wrangler = readFileSync('workers/wrangler.toml', 'utf8');
    expect(wrangler).toMatch(/required\s*=\s*\[[^\]]*"AI_CREDENTIAL_KEYRING"/s);
  });

  it('binds encrypted credentials to both owner and provider', async () => {
    const cipher = await encryptCredential(
      keyring,
      'teacher-a',
      'gemini',
      'security-canary-key-123456789',
    );

    await expect(decryptCredential(keyring, 'teacher-a', 'gemini', cipher))
      .resolves.toBe('security-canary-key-123456789');
    await expect(decryptCredential(keyring, 'teacher-b', 'gemini', cipher))
      .rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(decryptCredential(keyring, 'teacher-a', 'deepseek', cipher))
      .rejects.toThrow('AI_VAULT_UNAVAILABLE');
  });

  it('keeps credential routes teacher-owned and session scoped', () => {
    for (const [path, method] of [
      ['/api/account/ai-credentials', 'GET'],
      ['/api/account/ai-credentials/gemini', 'PUT'],
      ['/api/account/ai-credentials/deepseek/test', 'POST'],
      ['/api/account/ai-credentials/gemini', 'DELETE'],
    ] as const) {
      expect(findApiAuthorizationPolicy(path, method)).toMatchObject({
        authorization: 'teacher-owned',
        ownership: expect.arrayContaining(['session', 'route-handler']),
      });
    }
  });

  it('rejects forged models and non-text messages before any upstream call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(dispatchPersonalAi({
      provider: 'gemini',
      key: 'security-canary-key-123456789',
      model: 'attacker-controlled-model',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toMatchObject({ code: 'AI_CAPABILITY_UNSUPPORTED' });

    await expect(dispatchPersonalAi({
      provider: 'gemini',
      key: 'security-canary-key-123456789',
      model: 'gemini-3.8-flash',
      messages: [{
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'https://attacker.invalid/x.png' } }],
      }],
    })).rejects.toMatchObject({ code: 'AI_CAPABILITY_UNSUPPORTED' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses only the fixed provider endpoint and never reflects a canary upstream error', async () => {
    const canary = 'security-canary-key-123456789';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'provider echoed ' + canary } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    const error = await dispatchPersonalAi({
      provider: 'deepseek',
      key: canary,
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'hello' }],
    }).catch((value) => value);

    expect(error).toBeInstanceOf(AiPersonalDispatchError);
    expect(error.code).toBe('AI_KEY_INVALID');
    expect(String(error.message)).not.toContain(canary);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.redirect).toBe('manual');
    expect(JSON.stringify([
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ])).not.toContain(canary);
  });

  it('rejects dispatch redirects without following them or forwarding the key again', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 307,
      headers: { Location: 'https://attacker.invalid/collect' },
    }));

    await expect(dispatchPersonalAi({
      provider: 'deepseek',
      key: 'security-canary-key-123456789',
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toMatchObject({
      code: 'AI_PROVIDER_REQUEST_REJECTED',
      phase: 'redirect',
      upstreamStatus: 307,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caps oversized provider responses without returning provider content', async () => {
    const oversized = JSON.stringify({
      choices: [{ message: { content: 'x'.repeat((2 * 1024 * 1024) + 1024) } }],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(oversized, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(dispatchPersonalAi({
      provider: 'gemini',
      key: 'security-canary-key-123456789',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toMatchObject({
      code: 'AI_PROVIDER_RESPONSE_INVALID',
      phase: 'response-size',
    });
  });

  it.each([
    [400, 'AI_PROVIDER_REQUEST_REJECTED'],
    [403, 'AI_PROVIDER_ACCOUNT_REQUIRED'],
    [429, 'AI_PROVIDER_QUOTA'],
    [503, 'AI_PROVIDER_UNAVAILABLE'],
  ] as const)('maps dispatch upstream %s to %s without reflecting provider text', async (status, code) => {
    const canary = 'provider-body-secret-never-reflect';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: status,
        status: status === 403 ? 'PERMISSION_DENIED' : 'INVALID_ARGUMENT',
        message: `provider echoed ${canary}`,
      },
    }), { status, headers: { 'Content-Type': 'application/json' } }));

    const error = await dispatchPersonalAi({
      provider: 'gemini',
      key: 'security-canary-key-123456789',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'return JSON' }],
      responseFormat: { type: 'json_object' },
    }).catch((value) => value);

    expect(error).toBeInstanceOf(AiPersonalDispatchError);
    expect(error).toMatchObject({ code, phase: 'upstream', upstreamStatus: status });
    expect(JSON.stringify(error)).not.toContain(canary);
    expect(String(error.message)).not.toContain(canary);
  });

  it('distinguishes network failures from malformed provider responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValueOnce(new TypeError('connect failed'));

    await expect(dispatchPersonalAi({
      provider: 'deepseek',
      key: 'security-canary-key-123456789',
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'return JSON' }],
    })).rejects.toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', phase: 'network' });

    fetchSpy.mockResolvedValueOnce(new Response('not-json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(dispatchPersonalAi({
      provider: 'deepseek',
      key: 'security-canary-key-123456789',
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'return JSON' }],
    })).rejects.toMatchObject({ code: 'AI_PROVIDER_RESPONSE_INVALID', phase: 'response-json' });
  });

  it('records an allowlisted finish reason when the provider returns no content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'content_filter', message: { content: '' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(dispatchPersonalAi({
      provider: 'gemini',
      key: 'security-canary-key-123456789',
      model: 'gemini-3.8-flash',
      messages: [{ role: 'user', content: 'return JSON' }],
    })).rejects.toMatchObject({
      code: 'AI_PROVIDER_RESPONSE_INVALID',
      phase: 'response-content',
      finishReason: 'content_filter',
    });
  });
});
