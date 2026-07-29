import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), patch: vi.fn(), rollback: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('../src/services/featureRolloutService', () => ({
  listFeatureFlags: mocks.list,
  patchRuntimeFeatureFlag: mocks.patch,
  rollbackRuntimeFeatureFlag: mocks.rollback,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.success, showError: mocks.error }));

import { FeatureRolloutPanel } from '../src/features/feature-rollout/FeatureRolloutPanel';

const flag = {
  key: 'unified_notifications_v1', description: 'Unified notifications', enabled: true,
  audience: 'teacher', percentage: 5, allowUsers: [], allowClasses: ['class-4a'],
  startsAt: null, endsAt: null, owner: 'platform', reason: 'pilot',
  stopConditions: { max5xxRatePercent: 1, maxClientErrorMultiplier: 2, maxP95IncreasePercent: 30 },
  version: 2, updatedBy: 'admin', updatedAt: '2026-07-29T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([flag]);
  mocks.patch.mockResolvedValue({ ...flag, percentage: 25, version: 3 });
  mocks.rollback.mockResolvedValue({ ...flag, version: 4 });
});

describe('FeatureRolloutPanel', () => {
  it('previews the cohort and patches exactly one selected field with a reason', async () => {
    render(<FeatureRolloutPanel />);
    expect((await screen.findByText(/Preview cohort:/)).parentElement).toHaveTextContent('teacher, 5%');
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Lý do bắt buộc'), { target: { value: 'Mở pilot 25%' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu một trường' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('unified_notifications_v1', {
      field: 'percentage', value: 25, reason: 'Mở pilot 25%',
    }));
  });

  it('requires a reason and can rollback without a deploy', async () => {
    render(<FeatureRolloutPanel />);
    await screen.findByText(/Preview cohort:/);
    fireEvent.click(screen.getByRole('button', { name: 'Rollback gần nhất' }));
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Hãy nhập lý do rollback.');
    fireEvent.change(screen.getByLabelText('Lý do bắt buộc'), { target: { value: 'Stop condition breached' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rollback gần nhất' }));
    await waitFor(() => expect(mocks.rollback).toHaveBeenCalledWith('unified_notifications_v1', 'Stop condition breached'));
  });
});
