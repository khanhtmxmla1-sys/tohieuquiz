import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiCredentialSettings from '../src/features/quiz-generator/components/AiCredentialSettings';
import { useAiCredentials } from '../src/features/quiz-generator/hooks/useAiCredentials';

const serviceMocks = vi.hoisted(() => ({
  fetchAiCredentialState: vi.fn(),
  saveAiCredential: vi.fn(),
  testAiCredential: vi.fn(),
  deleteAiCredential: vi.fn(),
  saveAiPreference: vi.fn(),
}));

vi.mock('../src/services/ai/aiCredentialService', () => serviceMocks);

const emptyState = {
  enabled: true,
  defaultSource: 'system' as const,
  capabilities: {
    text: true,
    documents: false,
    images: false,
    ocr: false,
    webSearch: false,
    imageGeneration: false,
  },
  credentials: [
    { provider: 'gemini', configured: false, last4: null, version: 0, verifiedAt: null, updatedAt: null },
    { provider: 'deepseek', configured: false, last4: null, version: 0, verifiedAt: null, updatedAt: null },
  ],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.fetchAiCredentialState.mockResolvedValue(emptyState);
  serviceMocks.saveAiCredential.mockResolvedValue({
    provider: 'gemini',
    configured: true,
    last4: '7890',
    version: 1,
    verifiedAt: '2026-09-25T05:00:00.000Z',
    updatedAt: '2026-09-25T05:00:00.000Z',
  });
  serviceMocks.saveAiPreference.mockResolvedValue({ defaultSource: 'gemini-personal' });
});

describe('useAiCredentials', () => {
  it('loads server metadata and ignores a late response from the previous account', async () => {
    const first = deferred<typeof emptyState>();
    const second = deferred<typeof emptyState>();
    serviceMocks.fetchAiCredentialState
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ username }) => useAiCredentials(username),
      { initialProps: { username: 'teacher-a' as string | null } },
    );

    rerender({ username: 'teacher-b' });
    second.resolve({
      ...emptyState,
      credentials: [
        { provider: 'gemini', configured: true, last4: 'bbbb', version: 2, verifiedAt: null, updatedAt: null },
        emptyState.credentials[1],
      ],
    });
    await waitFor(() => expect(result.current.summaries.gemini.last4).toBe('bbbb'));

    first.resolve({
      ...emptyState,
      credentials: [
        { provider: 'gemini', configured: true, last4: 'aaaa', version: 1, verifiedAt: null, updatedAt: null },
        emptyState.credentials[1],
      ],
    });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.summaries.gemini.last4).toBe('bbbb');
  });

  it('saves a key through the service without writing the key to browser storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useAiCredentials('teacher-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const canary = 'gemini-canary-browser-key-1234567890';
    await act(async () => {
      await result.current.save('gemini', canary);
    });

    expect(serviceMocks.saveAiCredential).toHaveBeenCalledWith(
      'gemini',
      { apiKey: canary, expectedVersion: 0 },
      expect.anything(),
    );
    expect(result.current.summaries.gemini).toMatchObject({
      configured: true,
      last4: '7890',
      version: 1,
    });
    expect(storageSpy.mock.calls.some((call) => JSON.stringify(call).includes(canary))).toBe(false);
  });

  it('loads and updates the account default source through the server', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    serviceMocks.fetchAiCredentialState.mockResolvedValue({
      ...emptyState,
      defaultSource: 'deepseek-personal',
    });
    const { result } = renderHook(() => useAiCredentials('teacher-a'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.defaultSource).toBe('deepseek-personal');
    await act(async () => {
      await result.current.setDefaultSource('gemini-personal');
    });

    expect(serviceMocks.saveAiPreference).toHaveBeenCalledWith(
      { defaultSource: 'gemini-personal' },
      expect.anything(),
    );
    expect(result.current.defaultSource).toBe('gemini-personal');
    expect(storageSpy).not.toHaveBeenCalledWith('ai_provider', expect.anything());
  });
});

describe('AiCredentialSettings', () => {
  it('clears the key field after save and never shows a plaintext key from server metadata', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const controller = {
      enabled: true,
      capabilities: emptyState.capabilities,
      summaries: {
        gemini: emptyState.credentials[0],
        deepseek: emptyState.credentials[1],
      },
      loading: false,
      error: null,
      save,
      test: vi.fn(),
      remove: vi.fn(),
      refetch: vi.fn(),
    };

    render(<AiCredentialSettings provider="gemini" controller={controller as never} />);

    const input = screen.getByLabelText('API key Gemini') as HTMLInputElement;
    expect(input.closest('form')).not.toBeNull();
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện API key' }));
    expect(input.type).toBe('text');

    fireEvent.change(input, { target: { value: 'gemini-canary-browser-key-1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và lưu' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(
      'gemini',
      'gemini-canary-browser-key-1234567890',
    ));
    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.queryByText('gemini-canary-browser-key-1234567890')).not.toBeInTheDocument();
  });
});
