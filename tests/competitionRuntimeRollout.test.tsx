import { act, renderHook, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRuntimeFeatureFlagMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/featureRolloutService', () => ({
  resolveRuntimeFeatureFlag: resolveRuntimeFeatureFlagMock,
}));

import { useCompetitionV1FeatureFlag } from '../src/features/competition/useCompetitionV1FeatureFlag';

describe('Competition V1 runtime rollout', () => {
  beforeEach(() => {
    resolveRuntimeFeatureFlagMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not contact the runtime control plane when the build gate is disabled', async () => {
    vi.stubEnv('VITE_FEATURE_COMPETITION_V1', 'false');

    const { result } = renderHook(() => useCompetitionV1FeatureFlag());

    await waitFor(() => expect(result.current).toEqual({ enabled: false, ready: true, degraded: false }));
    expect(resolveRuntimeFeatureFlagMock).not.toHaveBeenCalled();
  });

  it('enables only when both the build gate and personalized runtime resolution allow access', async () => {
    vi.stubEnv('VITE_FEATURE_COMPETITION_V1', 'true');
    resolveRuntimeFeatureFlagMock.mockResolvedValue({
      key: 'competition_v1', enabled: true, reason: 'allowlist', bucket: null, version: 1,
    });

    const { result } = renderHook(() => useCompetitionV1FeatureFlag());

    await waitFor(() => expect(result.current).toEqual({ enabled: true, ready: true, degraded: false }));
    expect(resolveRuntimeFeatureFlagMock).toHaveBeenCalledWith('competition_v1');
  });

  it('fails closed and refreshes after an audited rollout update', async () => {
    vi.stubEnv('VITE_FEATURE_COMPETITION_V1', 'true');
    resolveRuntimeFeatureFlagMock
      .mockRejectedValueOnce(new Error('control plane unavailable'))
      .mockResolvedValueOnce({
        key: 'competition_v1', enabled: true, reason: 'percentage', bucket: 1, version: 2,
      });

    const { result } = renderHook(() => useCompetitionV1FeatureFlag());
    await waitFor(() => expect(result.current).toEqual({ enabled: false, ready: true, degraded: true }));

    act(() => window.dispatchEvent(new CustomEvent('tohieuquiz:feature-flags-updated')));
    await waitFor(() => expect(result.current).toEqual({ enabled: true, ready: true, degraded: false }));
  });
});

describe('Competition V1 rollout migration', () => {
  it('seeds a disabled runtime flag in both the forward migration and fresh schema', () => {
    const migration = readFileSync('workers/migrations/0079_competition_runtime_rollout.sql', 'utf8');
    const schema = readFileSync('workers/schema.sql', 'utf8');

    for (const source of [migration, schema]) {
      expect(source).toContain("'competition_v1'");
      expect(source).toMatch(/'competition_v1'[\s\S]*?Competition V1[\s\S]*?,\s*0,\s*'competition-platform'/);
      expect(source).toContain('"max5xxRatePercent":1');
      expect(source).toContain('"maxClientErrorMultiplier":2');
      expect(source).toContain('"maxP95IncreasePercent":30');
    }
  });
});
