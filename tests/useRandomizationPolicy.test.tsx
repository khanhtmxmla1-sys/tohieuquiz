// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSystemSettings: vi.fn() }));
vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: mocks.getSystemSettings,
}));

import { useRandomizationPolicy } from '../src/features/randomization/useRandomizationPolicy';

describe('useRandomizationPolicy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves master off into all effective random flags off', async () => {
    mocks.getSystemSettings.mockResolvedValue({
      aiAssistantEnabled: true,
      unifiedNotificationsEnabled: false,
      randomization: {
        enabled: false,
        shuffleQuestions: true,
        shuffleChoices: true,
        shuffleMatching: true,
        shuffleOrdering: true,
        shuffleDragDrop: true,
        randomizePracticeSelection: true,
      },
    });

    const { result } = renderHook(() => useRandomizationPolicy());
    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current).toEqual({
      enabled: false,
      shuffleQuestions: false,
      shuffleChoices: false,
      shuffleMatching: false,
      shuffleOrdering: false,
      shuffleDragDrop: false,
      randomizePracticeSelection: false,
    });
  });

  it('falls back to legacy-compatible defaults when settings cannot be loaded', async () => {
    mocks.getSystemSettings.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useRandomizationPolicy());
    await waitFor(() => expect(mocks.getSystemSettings).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({
      enabled: true,
      shuffleQuestions: true,
      shuffleChoices: false,
      shuffleMatching: true,
      shuffleOrdering: true,
      shuffleDragDrop: true,
      randomizePracticeSelection: true,
    });
  });
});
