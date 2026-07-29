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
  id: 'credential-1', label: 'Laptop gi?o vi?n', deviceType: 'singleDevice', backedUp: false,
  createdAt: '2026-07-29T08:00:00.000Z', lastUsedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.list.mockResolvedValue([passkey]);
  mocks.register.mockResolvedValue({ ...passkey, id: 'credential-2', label: '?i?n tho?i' });
  mocks.revoke.mockResolvedValue(undefined);
});

describe('PasskeyPanel', () => {
  it('lists privacy-minimal credentials and registers a named passkey', async () => {
    render(<PasskeyPanel />);
    expect(await screen.findByText('Laptop gi?o vi?n')).toBeInTheDocument();
    expect(screen.queryByText(/credential-1/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('T?n thi?t b?'), { target: { value: '?i?n tho?i' } });
    fireEvent.click(screen.getByRole('button', { name: 'Th?m passkey' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith('?i?n tho?i'));
    expect(await screen.findByText('?i?n tho?i')).toBeInTheDocument();
  });

  it('revokes a credential only after server confirmation', async () => {
    render(<PasskeyPanel />);
    const list = await screen.findByRole('list', { name: 'Danh s?ch passkey' });
    const item = within(list).getByText('Laptop gi?o vi?n').closest('article');
    fireEvent.click(within(item!).getByRole('button', { name: 'X?a' }));
    await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith('credential-1'));
    await waitFor(() => expect(screen.queryByText('Laptop gi?o vi?n')).not.toBeInTheDocument());
  });

  it('keeps registration disabled when WebAuthn is unavailable', async () => {
    mocks.supported.mockReturnValue(false);
    mocks.list.mockResolvedValue([]);
    render(<PasskeyPanel />);
    expect(await screen.findByText(/WebAuthn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Th?m passkey' })).toBeDisabled();
  });
});
