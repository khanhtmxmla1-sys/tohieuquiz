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
    const valueInput = screen.getByLabelText('Giá trị');
    await waitFor(() => expect(valueInput).toHaveValue(5));
    fireEvent.change(valueInput, { target: { value: '25' } });
    expect(valueInput).toHaveValue(25);
    fireEvent.change(screen.getByLabelText('Lý do bắt buộc'), { target: { value: 'Mở pilot 25%' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu một trường' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('unified_notifications_v1', {
      field: 'percentage', value: 25, reason: 'Mở pilot 25%',
    }));
  });

  it('treats rollout datetime inputs as Hanoi time and sends UTC ISO values', async () => {
    mocks.list.mockResolvedValueOnce([{
      ...flag,
      startsAt: '2026-08-05T00:30:00.000Z',
    }]);
    mocks.patch.mockResolvedValueOnce({
      ...flag,
      startsAt: '2026-08-06T00:30:00.000Z',
      version: 3,
    });

    render(<FeatureRolloutPanel />);
    await screen.findByText(/Preview cohort:/);
    fireEvent.change(screen.getByLabelText('Trường thay đổi'), { target: { value: 'startsAt' } });

    const valueInput = screen.getByTestId('rollout-value');
    await waitFor(() => expect(valueInput).toHaveValue('2026-08-05T07:30'));
    expect(screen.getByText('Giờ Hà Nội (GMT+7)')).toBeInTheDocument();

    fireEvent.change(valueInput, { target: { value: '2026-08-06T07:30' } });
    fireEvent.change(screen.getByLabelText('Lý do bắt buộc'), { target: { value: 'Mở lúc đầu giờ học' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu một trường' }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('unified_notifications_v1', {
      field: 'startsAt',
      value: '2026-08-06T00:30:00.000Z',
      reason: 'Mở lúc đầu giờ học',
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
