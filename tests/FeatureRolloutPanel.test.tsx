import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), patch: vi.fn(), patchBatch: vi.fn(), rollback: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('../src/services/featureRolloutService', () => ({
  listFeatureFlags: mocks.list,
  patchRuntimeFeatureFlag: mocks.patch,
  patchRuntimeFeatureFlagBatch: mocks.patchBatch,
  rollbackRuntimeFeatureFlag: mocks.rollback,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.success, showError: mocks.error }));

import { FeatureRolloutPanel } from '../src/features/feature-rollout/FeatureRolloutPanel';

const flag = {
  key: 'unified_notifications_v1', description: 'Unified notifications', enabled: true,
  audience: 'teacher', percentage: 5, allowUsers: [], allowClasses: ['class-4a'],
  startsAt: null, endsAt: null, owner: 'platform', reason: 'Pilot giáo viên',
  stopConditions: { max5xxRatePercent: 1, maxClientErrorMultiplier: 2, maxP95IncreasePercent: 30 },
  version: 2, updatedBy: 'admin', updatedAt: '2026-07-29T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([flag]);
  mocks.patchBatch.mockImplementation(async (_key: string, batch: any) => ({
    ...flag,
    ...Object.fromEntries(batch.changes.map((change: any) => [change.field, change.value])),
    reason: batch.reason,
    version: flag.version + 1,
  }));
  mocks.rollback.mockResolvedValue({ ...flag, version: 3, reason: 'Rollback' });
});

describe('FeatureRolloutPanel', () => {
  it('shows friendly flag presentation, Vietnamese audience labels and four quick controls', async () => {
    mocks.list.mockResolvedValueOnce([
      flag,
      { ...flag, key: 'new_experiment_flag', description: 'Tính năng mới', enabled: false, version: 1 },
    ]);
    render(<FeatureRolloutPanel />);

    const selectedFlagButton = await screen.findByRole('button', { name: 'Thông báo hợp nhất' });
    expect(selectedFlagButton).toBeInTheDocument();
    expect(within(selectedFlagButton).getByText('unified_notifications_v1')).toBeInTheDocument();
    expect(within(selectedFlagButton).getByText(/Đang thử nghiệm 5%.*Giáo viên/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tính năng mới' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tắt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
    expect(screen.getByLabelText('Đối tượng thử nghiệm')).toHaveDisplayValue('Giáo viên');
    expect(screen.queryByLabelText('Trường thay đổi')).not.toBeInTheDocument();
  });

  it('applies a 10% teacher rollout as exactly one batch request with expectedVersion', async () => {
    mocks.list.mockResolvedValueOnce([{ ...flag, enabled: false, audience: 'all', percentage: 100 }]);
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });

    fireEvent.change(screen.getByLabelText('Đối tượng thử nghiệm'), { target: { value: 'teacher' } });
    fireEvent.click(screen.getByRole('button', { name: '10%' }));
    expect(screen.getByText('Trước khi áp dụng')).toBeInTheDocument();
    expect(screen.getByText('Sau khi áp dụng')).toBeInTheDocument();
    expect(screen.getByText(/nhóm cấu hình sẽ thay đổi/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Thử 10% giáo viên' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    await waitFor(() => expect(mocks.patchBatch).toHaveBeenCalledTimes(1));
    expect(mocks.patchBatch).toHaveBeenCalledWith('unified_notifications_v1', {
      changes: [
        { field: 'enabled', value: true },
        { field: 'audience', value: 'teacher' },
        { field: 'percentage', value: 10 },
      ],
      reason: 'Thử 10% giáo viên',
      expectedVersion: 2,
    });
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('creates the Off preset without overwriting unrelated rollout fields', async () => {
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });
    fireEvent.click(screen.getByRole('button', { name: 'Tắt' }));
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Tạm dừng thử nghiệm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    await waitFor(() => expect(mocks.patchBatch).toHaveBeenCalledWith('unified_notifications_v1', {
      changes: [{ field: 'enabled', value: false }],
      reason: 'Tạm dừng thử nghiệm',
      expectedVersion: 2,
    }));
  });

  it('uses dedicated advanced controls, Hanoi datetime conversion and no JSON stop-condition textarea', async () => {
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh nâng cao' }));

    expect(screen.getByText('Ngưỡng cần theo dõi')).toBeInTheDocument();
    expect(screen.getByText(/Không tự động tắt tính năng/i)).toBeInTheDocument();
    expect(screen.queryByText('Điều kiện dừng')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rollout-value')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Bắt đầu thử nghiệm'), { target: { value: '2026-08-06T07:30' } });
    fireEvent.change(screen.getByLabelText('Tỷ lệ lỗi 5xx tối đa (%)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Theo dõi đợt sáng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    await waitFor(() => expect(mocks.patchBatch).toHaveBeenCalledTimes(1));
    const batch = mocks.patchBatch.mock.calls[0][1];
    expect(batch.changes).toEqual(expect.arrayContaining([
      { field: 'startsAt', value: '2026-08-06T00:30:00.000Z' },
      {
        field: 'stopConditions',
        value: expect.objectContaining({ max5xxRatePercent: 2 }),
      },
    ]));
  });

  it('disables apply without a diff and requires a reason once a diff exists', async () => {
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });
    expect(screen.getByRole('button', { name: 'Áp dụng thay đổi' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '10%' }));
    const apply = screen.getByRole('button', { name: 'Áp dụng thay đổi' });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    expect(mocks.patchBatch).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Hãy nhập lý do thay đổi.');
  });

  it('reloads the latest version after a batch version conflict', async () => {
    mocks.list
      .mockResolvedValueOnce([flag])
      .mockResolvedValueOnce([{ ...flag, version: 3, percentage: 10, reason: 'Admin khác vừa cập nhật' }]);
    mocks.patchBatch.mockRejectedValueOnce(new Error('FEATURE_FLAG_VERSION_CONFLICT'));
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });

    fireEvent.click(screen.getByRole('button', { name: '10%' }));
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Thử 10%' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.error).toHaveBeenCalledWith('Cấu hình vừa được cập nhật ở nơi khác. Đã tải lại phiên bản mới nhất.');
    expect(await screen.findByText('v3')).toBeInTheDocument();
  });

  it('requires a reason and confirmation before rollback, showing current version and latest mutation', async () => {
    render(<FeatureRolloutPanel />);
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác thay đổi gần nhất' }));
    expect(mocks.error).toHaveBeenCalledWith('Hãy nhập lý do hoàn tác.');
    expect(mocks.rollback).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Dừng do lỗi tăng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác thay đổi gần nhất' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hoàn tác thay đổi gần nhất?' });
    expect(within(dialog).getByText(/v2/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Pilot giáo viên/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^Mutation gần nhất:/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận hoàn tác' }));

    await waitFor(() => expect(mocks.rollback).toHaveBeenCalledWith('unified_notifications_v1', 'Dừng do lỗi tăng'));
  });

  it('shows a skeleton while loading, inline retry on error and keeps the selected flag across refresh', async () => {
    const second = { ...flag, key: 'ai_assistant_enabled', description: 'AI assistant', version: 4 };
    mocks.list.mockResolvedValueOnce([flag, second]);
    render(<FeatureRolloutPanel />);

    expect(screen.getByRole('status', { name: 'Đang tải cấu hình tính năng' })).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Thông báo hợp nhất' });
    fireEvent.click(screen.getByRole('button', { name: /Trợ lý AI/ }));
    expect(screen.getByText('v4')).toBeInTheDocument();

    mocks.list.mockResolvedValueOnce([flag, { ...second, version: 5 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    expect(await screen.findByText('v5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trợ lý AI/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
