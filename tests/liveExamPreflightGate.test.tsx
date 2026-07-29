import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runPreflight = vi.hoisted(() => vi.fn());
vi.mock('../src/features/live-exam/liveExamPreflight', () => ({
  runLiveExamPreflight: runPreflight,
}));
vi.mock('../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, lastChangedAt: null }),
}));
vi.mock('../src/services/api/config', () => ({
  getWorkersApiBaseUrl: () => 'https://worker.test',
}));

import { LiveExamPreflightGate } from '../src/features/live-exam/LiveExamPreflightGate';

const failedResult = {
  ready: false,
  clockDriftMs: null,
  checkedAt: '2026-07-28T00:00:00.000Z',
  checks: [
    { id: 'online', ok: true, message: 'Đã kết nối mạng.' },
    { id: 'api-health', ok: false, message: 'Không thể kết nối máy chủ Live Exam.' },
  ],
};

const passedResult = {
  ready: true,
  clockDriftMs: 1_000,
  checkedAt: '2026-07-28T00:00:00.000Z',
  checks: [
    { id: 'online', ok: true, message: 'Đã kết nối mạng.' },
    { id: 'api-health', ok: true, message: 'Máy chủ Live Exam sẵn sàng.' },
  ],
};

describe('LiveExamPreflightGate', () => {
  beforeEach(() => runPreflight.mockReset());

  it('shows the exam only after every check passes', async () => {
    runPreflight.mockResolvedValue(passedResult);
    render(<LiveExamPreflightGate><div>Đề thi đã sẵn sàng</div></LiveExamPreflightGate>);

    expect(screen.getByText('Đang kiểm tra trước khi vào thi')).toBeVisible();
    expect(await screen.findByText('Đề thi đã sẵn sàng')).toBeVisible();
  });

  it('shows failed checks and can retry without losing the child screen', async () => {
    runPreflight.mockResolvedValueOnce(failedResult).mockResolvedValueOnce(passedResult);
    render(<LiveExamPreflightGate><div>Đề thi đã sẵn sàng</div></LiveExamPreflightGate>);

    expect(await screen.findByText('Chưa thể vào bài thi an toàn')).toBeVisible();
    expect(screen.getByText('Không thể kết nối máy chủ Live Exam.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));

    await waitFor(() => expect(runPreflight).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Đề thi đã sẵn sàng')).toBeVisible();
  });
});
