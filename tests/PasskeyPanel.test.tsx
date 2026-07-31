import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), supported: vi.fn(), register: vi.fn(), revoke: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('../src/services/passkeyService', () => ({
  getAccountPasskeys: mocks.list,
  passkeysSupported: mocks.supported,
  registerAccountPasskey: mocks.register,
  revokeAccountPasskey: mocks.revoke,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.success, showError: mocks.error }));

import { PasskeyPanel } from '../src/features/security/PasskeyPanel';

const passkey = {
  id: 'credential-1', label: 'Laptop giáo viên', deviceType: 'singleDevice', backedUp: false,
  createdAt: '2026-07-29T08:00:00.000Z', lastUsedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.list.mockResolvedValue([passkey]);
  mocks.register.mockResolvedValue({ ...passkey, id: 'credential-2', label: 'Điện thoại' });
  mocks.revoke.mockResolvedValue(undefined);
});

describe('PasskeyPanel', () => {
  it('lists privacy-minimal credentials and registers a named passkey', async () => {
    render(<PasskeyPanel />);
    expect(await screen.findByText('Laptop giáo viên')).toBeInTheDocument();
    expect(screen.queryByText(/credential-1/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tên thiết bị'), { target: { value: 'Điện thoại' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm passkey' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith('Điện thoại'));
    expect(await screen.findByText('Điện thoại')).toBeInTheDocument();
  });

  it('revokes a credential only after server confirmation', async () => {
    render(<PasskeyPanel />);
    const list = await screen.findByRole('list', { name: 'Danh sách passkey' });
    const item = within(list).getByText('Laptop giáo viên').closest('article');
    fireEvent.click(within(item!).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith('credential-1'));
    await waitFor(() => expect(screen.queryByText('Laptop giáo viên')).not.toBeInTheDocument());
  });

  it('keeps registration disabled when WebAuthn is unavailable', async () => {
    mocks.supported.mockReturnValue(false);
    mocks.list.mockResolvedValue([]);
    render(<PasskeyPanel />);
    expect(await screen.findByText(/WebAuthn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm passkey' })).toBeDisabled();
  });
});
