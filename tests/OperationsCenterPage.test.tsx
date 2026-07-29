import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callApi: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.showSuccess, showError: mocks.showError }));

import OperationsCenterPage from '../src/features/operations/OperationsCenterPage';

const snapshot = {
  overallStatus: 'degraded',
  checkedAt: '2026-07-29T09:00:00.000Z',
  requestId: 'req-ops-1',
  release: 'release-abc123',
  components: [
    { id: 'api', label: 'Worker API', status: 'healthy', checkedAt: '2026-07-29T09:00:00.000Z', latencyMs: 2, summary: 'API hoạt động.', metrics: [] },
    { id: 'r2', label: 'R2 storage', status: 'unavailable', checkedAt: '2026-07-29T09:00:00.000Z', latencyMs: 1000, summary: 'R2 không khả dụng.', code: 'PROBE_TIMEOUT', metrics: [{ key: 'probedBuckets', value: 0 }] },
  ],
};

beforeEach(() => {
  mocks.callApi.mockReset().mockResolvedValue({ status: 'success', data: snapshot });
  mocks.showSuccess.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('OperationsCenterPage', () => {
  it('shows overall/component health, last checked and inline runbooks without raw logs', async () => {
    render(<OperationsCenterPage />);
    expect(await screen.findByRole('heading', { name: 'Operations Center' })).toBeInTheDocument();
    expect(screen.getByText('Toàn hệ thống: Suy giảm')).toBeInTheDocument();
    expect(screen.getByText('Worker API')).toBeInTheDocument();
    expect(screen.getByText('R2 storage')).toBeInTheDocument();
    expect(screen.getByText('PROBE_TIMEOUT')).toBeInTheDocument();
    expect(screen.getAllByText('Runbook xử lý')).toHaveLength(2);
    expect(screen.queryByText(/raw log content|database identifier|credential value/i)).not.toBeInTheDocument();
  });

  it('copies request ID and release SHA and refreshes on demand', async () => {
    render(<OperationsCenterPage />);
    const requestButton = await screen.findByRole('button', { name: /Request ID: req-ops-1/ });
    fireEvent.click(requestButton);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('req-ops-1'));
    fireEvent.click(screen.getByRole('button', { name: /Release: release-abc123/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('release-abc123'));
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    await waitFor(() => expect(mocks.callApi).toHaveBeenCalledTimes(2));
  });

  it('offers a retry state when the admin snapshot fails', async () => {
    mocks.callApi.mockRejectedValueOnce(new Error('Operations API unavailable'));
    render(<OperationsCenterPage />);
    expect(await screen.findByText('Không thể tải Operations Center')).toBeInTheDocument();
    expect(screen.getByText('Operations API unavailable')).toBeInTheDocument();
  });
});
