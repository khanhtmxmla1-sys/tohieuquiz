import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiCredentialSummary,
  PersonalAiProvider,
} from '../../../../shared/teacher-ai-credentials.contract';
import {
  deleteAiCredential,
  fetchAiCredentialState,
  saveAiCredential,
  testAiCredential,
  type AiCredentialCapabilities,
} from '../../../services/ai/aiCredentialService';

const EMPTY_CAPABILITIES: AiCredentialCapabilities = {
  text: false,
  documents: false,
  images: false,
  ocr: false,
  webSearch: false,
  imageGeneration: false,
};

const emptySummary = (provider: PersonalAiProvider): AiCredentialSummary => ({
  provider,
  configured: false,
  last4: null,
  version: 0,
  verifiedAt: null,
  updatedAt: null,
});

export interface AiCredentialsController {
  enabled: boolean;
  capabilities: AiCredentialCapabilities;
  summaries: Record<PersonalAiProvider, AiCredentialSummary>;
  loading: boolean;
  error: string | null;
  save: (provider: PersonalAiProvider, apiKey: string) => Promise<void>;
  test: (provider: PersonalAiProvider) => Promise<void>;
  remove: (provider: PersonalAiProvider) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useAiCredentials = (username: string | null): AiCredentialsController => {
  const [enabled, setEnabled] = useState(false);
  const [capabilities, setCapabilities] = useState<AiCredentialCapabilities>(EMPTY_CAPABILITIES);
  const [summaries, setSummaries] = useState<Record<PersonalAiProvider, AiCredentialSummary>>({
    gemini: emptySummary('gemini'),
    deepseek: emptySummary('deepseek'),
  });
  const [loading, setLoading] = useState(Boolean(username));
  const [error, setError] = useState<string | null>(null);
  const accountRef = useRef(username);
  const loadSequence = useRef(0);

  accountRef.current = username;

  const reset = useCallback(() => {
    setEnabled(false);
    setCapabilities(EMPTY_CAPABILITIES);
    setSummaries({
      gemini: emptySummary('gemini'),
      deepseek: emptySummary('deepseek'),
    });
    setError(null);
  }, []);

  const applySummary = useCallback((summary: AiCredentialSummary) => {
    setSummaries((current) => ({ ...current, [summary.provider]: summary }));
  }, []);

  const load = useCallback(async (): Promise<void> => {
    const account = username;
    const sequence = ++loadSequence.current;
    if (!account) {
      reset();
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const state = await fetchAiCredentialState(controller.signal);
      if (loadSequence.current !== sequence || accountRef.current !== account) return;
      const next = {
        gemini: emptySummary('gemini'),
        deepseek: emptySummary('deepseek'),
      };
      for (const summary of state.credentials) next[summary.provider] = summary;
      setEnabled(state.enabled);
      setCapabilities(state.capabilities);
      setSummaries(next);
    } catch (loadError) {
      if (loadSequence.current !== sequence || accountRef.current !== account) return;
      const message = loadError instanceof Error
        ? loadError.message
        : 'Không thể tải trạng thái API key AI.';
      if (!/Đã hủy yêu cầu/.test(message)) setError(message);
    } finally {
      if (loadSequence.current === sequence && accountRef.current === account) setLoading(false);
    }
  }, [reset, username]);

  useEffect(() => {
    reset();
    setLoading(Boolean(username));
    void load();
    return () => {
      loadSequence.current += 1;
    };
  }, [load, reset, username]);

  const runForCurrentAccount = useCallback(async (
    operation: (signal: AbortSignal) => Promise<AiCredentialSummary | void>,
  ): Promise<AiCredentialSummary | void> => {
    const account = username;
    if (!account) throw new Error('Phiên đăng nhập không còn hợp lệ.');
    const controller = new AbortController();
    setError(null);
    try {
      const result = await operation(controller.signal);
      if (accountRef.current !== account) return undefined;
      if (result) applySummary(result);
      return result;
    } catch (operationError) {
      if (accountRef.current !== account) return undefined;
      const message = operationError instanceof Error
        ? operationError.message
        : 'Không thể xử lý API key AI.';
      setError(message);
      throw operationError;
    }
  }, [applySummary, username]);

  const save = useCallback(async (provider: PersonalAiProvider, apiKey: string): Promise<void> => {
    const expectedVersion = summaries[provider].version;
    await runForCurrentAccount((signal) => saveAiCredential(
      provider,
      { apiKey, expectedVersion },
      signal,
    ));
  }, [runForCurrentAccount, summaries]);

  const test = useCallback(async (provider: PersonalAiProvider): Promise<void> => {
    await runForCurrentAccount((signal) => testAiCredential(provider, signal));
  }, [runForCurrentAccount]);

  const remove = useCallback(async (provider: PersonalAiProvider): Promise<void> => {
    const expectedVersion = summaries[provider].version;
    await runForCurrentAccount(async (signal) => {
      await deleteAiCredential(provider, expectedVersion, signal);
      return emptySummary(provider);
    });
  }, [runForCurrentAccount, summaries]);

  return useMemo(() => ({
    enabled,
    capabilities,
    summaries,
    loading,
    error,
    save,
    test,
    remove,
    refetch: load,
  }), [
    capabilities,
    enabled,
    error,
    load,
    loading,
    remove,
    save,
    summaries,
    test,
  ]);
};
