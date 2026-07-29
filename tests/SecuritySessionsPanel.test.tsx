import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => api);
vi.mock('../src/utils/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));

import { SecuritySessionsPanel } from '../src/features/security/SecuritySessionsPanel';

const sessions = [
  { id: 'current', current: true, userAgentFamily: 'Chrome', createdAt: '2026-07-29T08:00:00.000Z', lastSeenAt: '2026-07-29T09:00:00.000Z', expiresAt: '2026-08-05T08:00:00.000Z' },
  { id: 'other', current: false, userAgentFamily: 'Firefox', createdAt: '2026-07-28T08:00:00.000Z', lastSeenAt: '2026-07-28T09:00:00.000Z', expiresAt: '2026-08-04T08:00:00.000Z' },
];

beforeEach(() => {
  api.callApi.mockReset();
  api.callApi.mockImplementation(async (action: string) => {
    if (action === 'get_account_sessions') return { data: sessions };
    if (action === 'get_account_security_events') return { data: [{ id: 'event-1', eventType: 'PASSWORD_CHANGED', severity: 'informational', actorUsername: null, sessionId: null, createdAt: '2026-07-29T07:00:00.000Z', metadata: {} }] };
    if (action === 'revoke_account_session') return { status: 'success' };
    throw new Error(`unexpected action ${action}`);
  });
});

describe('SecuritySessionsPanel', () => {
  it('shows privacy-minimal sessions and security events without IP fields', async () => {
    render(<SecuritySessionsPanel />);
    expect(await screen.findByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('Firefox')).toBeInTheDocument();
    expect(screen.getByText('Phiên hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Đã đổi mật khẩu')).toBeInTheDocument();
    expect(screen.queryByText(/192\.168\.|ip address/i)).not.toBeInTheDocument();
  });

  it('revokes only a non-current session and removes it after server confirmation', async () => {
    render(<SecuritySessionsPanel />);
    const list = await screen.findByRole('list', { name: 'Danh sách phiên đăng nhập' });
    const firefox = within(list).getByText('Firefox').closest('article');
    fireEvent.click(within(firefox!).getByRole('button', { name: 'Thu hồi' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('revoke_account_session', { sessionId: 'other' }));
    await waitFor(() => expect(screen.queryByText('Firefox')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Thu hồi' })).not.toBeInTheDocument();
  });
});
