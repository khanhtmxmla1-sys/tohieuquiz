import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getParentLink: vi.fn(),
  createParentLink: vi.fn(),
  reissueParentLink: vi.fn(),
  revokeParentLink: vi.fn(),
  qrToString: vi.fn(),
  onClose: vi.fn(),
  clipboardWrite: vi.fn(),
  print: vi.fn(),
}));

vi.mock('../src/features/parent-portal/parentPortalService', () => ({
  getParentLink: mocks.getParentLink,
  createParentLink: mocks.createParentLink,
  reissueParentLink: mocks.reissueParentLink,
  revokeParentLink: mocks.revokeParentLink,
}));
vi.mock('qrcode', () => ({ default: { toString: mocks.qrToString } }));

import ParentAccessModal from '../src/features/class-management/components/ParentAccessModal';

const link = {
  id: 'link-1', studentId: 'student-1', accessCode: 'ABCDEFG234', status: 'PENDING' as const,
  tokenVersion: 1, createdBy: 'teacher-a', createdAt: '2026-07-22T00:00:00.000Z',
  activatedAt: null, revokedAt: null, lastAccessedAt: null,
};
const activationUrl = 'https://phuhuynh.thtohieu.com/activate?token=opaque-token';

const renderModal = () => render(
  <ParentAccessModal
    studentId="student-1"
    studentName="Nguyễn Văn An"
    className="4A9"
    onClose={mocks.onClose}
  />,
);

describe('ParentAccessModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getParentLink.mockResolvedValue({ link: null });
    mocks.createParentLink.mockResolvedValue({ link, activationUrl });
    mocks.reissueParentLink.mockResolvedValue({ link: { ...link, tokenVersion: 2 }, activationUrl: `${activationUrl}-new` });
    mocks.revokeParentLink.mockResolvedValue({ id: 'link-1', status: 'REVOKED' });
    mocks.qrToString.mockResolvedValue('<svg aria-label="QR phụ huynh"></svg>');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.clipboardWrite } });
    vi.stubGlobal('print', mocks.print);
  });

  it('traps dialog focus and closes with Escape when no mutation is running', async () => {
    renderModal();
    await screen.findByText('Chưa cấp quyền phụ huynh');

    expect(screen.getByRole('dialog', { name: 'Quyền phụ huynh của Nguyễn Văn An' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });

  it('creates a one-time QR and shows the safe access code', async () => {
    renderModal();
    await screen.findByText('Chưa cấp quyền phụ huynh');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo QR phụ huynh' }));

    await waitFor(() => expect(mocks.createParentLink).toHaveBeenCalledWith('student-1'));
    expect(await screen.findByText('ABCDEFG234')).toBeInTheDocument();
    expect((await screen.findByTestId('parent-qr-svg')).innerHTML).toContain('<svg');
    expect(mocks.qrToString).toHaveBeenCalledWith(activationUrl, expect.objectContaining({ type: 'svg' }));
  });

  it('copies the activation link and prints the QR sheet', async () => {
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo QR phụ huynh' }));
    await screen.findByTestId('parent-qr-svg');

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép liên kết' }));
    await waitFor(() => expect(mocks.clipboardWrite).toHaveBeenCalledWith(activationUrl));
    fireEvent.click(screen.getByRole('button', { name: 'In phiếu QR' }));
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });

  it('reissues a link and replaces the old QR', async () => {
    mocks.getParentLink.mockResolvedValue({ link: { ...link, status: 'ACTIVE' } });
    renderModal();
    expect(await screen.findByText('Đã kích hoạt')).toBeInTheDocument();
    expect(screen.queryByTestId('parent-qr-svg')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cấp lại QR' }));
    await waitFor(() => expect(mocks.reissueParentLink).toHaveBeenCalledWith('link-1'));
    await waitFor(() => expect(mocks.qrToString).toHaveBeenLastCalledWith(`${activationUrl}-new`, expect.any(Object)));
  });

  it('revokes access and removes QR/link controls', async () => {
    mocks.getParentLink.mockResolvedValue({ link: { ...link, status: 'ACTIVE' } });
    renderModal();
    await screen.findByText('Đã kích hoạt');
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi quyền' }));

    await waitFor(() => expect(mocks.revokeParentLink).toHaveBeenCalledWith('link-1'));
    expect(screen.getByText('Đã thu hồi')).toBeInTheDocument();
    expect(screen.queryByTestId('parent-qr-svg')).not.toBeInTheDocument();
    expect(screen.queryByText('ABCDEFG234')).not.toBeInTheDocument();
  });
});
