// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSystemSettingsMock = vi.hoisted(() => vi.fn());
const resolveRuntimeFeatureFlagMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: getSystemSettingsMock,
}));
vi.mock('../src/services/featureRolloutService', () => ({
  resolveRuntimeFeatureFlag: resolveRuntimeFeatureFlagMock,
}));

import { useSystemSettings } from '../src/app/useSystemSettings';
import { useAuthStore } from '../stores/authStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';

describe('system setting resolution by session state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'anonymous', isLoggedIn: false });
    useClassroomStore.setState({ studentSession: null });
  });

  it('loads the public setting while anonymous without calling the protected resolver', async () => {
    getSystemSettingsMock.mockResolvedValue({ aiAssistantEnabled: false });

    const { result } = renderHook(() => useSystemSettings());

    await waitFor(() => expect(result.current).toBe(false));
    expect(getSystemSettingsMock).toHaveBeenCalledTimes(1);
    expect(resolveRuntimeFeatureFlagMock).not.toHaveBeenCalled();
  });

  it('uses personalized resolution after a teacher session is authenticated', async () => {
    useAuthStore.setState({ status: 'authenticated', isLoggedIn: true });
    resolveRuntimeFeatureFlagMock.mockResolvedValue({ enabled: false });

    const { result } = renderHook(() => useSystemSettings());

    await waitFor(() => expect(result.current).toBe(false));
    expect(resolveRuntimeFeatureFlagMock).toHaveBeenCalledWith('ai_assistant_enabled');
    expect(getSystemSettingsMock).not.toHaveBeenCalled();
  });
});
