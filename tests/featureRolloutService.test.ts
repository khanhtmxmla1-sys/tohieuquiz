import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));

import { patchRuntimeFeatureFlagBatch } from '../src/services/featureRolloutService';

describe('featureRolloutService batch patch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends one batch mutation with changes, reason and expectedVersion', async () => {
    const data = {
      key: 'flag-a', description: 'Flag A', enabled: true, audience: 'teacher', percentage: 10,
      allowUsers: [], allowClasses: [], startsAt: null, endsAt: null, owner: 'platform', reason: 'Pilot 10%',
      stopConditions: {}, version: 2, updatedBy: 'admin', updatedAt: '2026-08-11T01:00:00.000Z',
    };
    mocks.callApi.mockResolvedValue({ status: 'success', data });
    const batch = {
      changes: [
        { field: 'enabled' as const, value: true },
        { field: 'audience' as const, value: 'teacher' },
        { field: 'percentage' as const, value: 10 },
      ],
      reason: 'Pilot 10%',
      expectedVersion: 1,
    };

    const result = await patchRuntimeFeatureFlagBatch('flag-a', batch);

    expect(mocks.callApi).toHaveBeenCalledTimes(1);
    expect(mocks.callApi).toHaveBeenCalledWith('patch_feature_flag_batch', { key: 'flag-a', ...batch });
    expect(result).toEqual(data);
  });
});
