import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveHostContext } from '../src/app/hostContext';
import ParentPortalApp from '../src/features/parent-portal/ParentPortalApp';
import { useParentPortalStore } from '../src/features/parent-portal/useParentPortalStore';

const service = vi.hoisted(() => ({
  getParentActivation: vi.fn(),
}));
vi.mock('../src/features/parent-portal/parentPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/parent-portal/parentPortalService')>(),
  getParentActivation: service.getParentActivation,
}));

const student = { id: 'student-1', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' };
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="parent-location">{location.pathname}{location.search}</div>;
};
const renderPortal = (entry: string) => render(
  <MemoryRouter initialEntries={[entry]}>
    <ParentPortalApp />
    <LocationProbe />
  </MemoryRouter>,
);

const resetStore = (overrides: Record<string, unknown> = {}) => {
  useParentPortalStore.setState({
    session: null,
    dashboard: null,
    notifications: [],
    unreadCount: 0,
    isRestoring: false,
    isLoading: false,
    error: null,
    restoreSession: vi.fn(async () => undefined),
    login: vi.fn(async () => false),
    activate: vi.fn(async () => false),
    logout: vi.fn(async () => undefined),
    loadDashboard: vi.fn(async () => undefined),
    loadNotifications: vi.fn(async () => undefined),
    markNotificationRead: vi.fn(async () => undefined),
    ...overrides,
  });
};

describe('parent host context', () => {
  it('recognizes the production hostname and explicit localhost opt-in', () => {
    expect(resolveHostContext('phuhuynh.thtohieu.com')).toBe('parent');
    expect(resolveHostContext('PHUHUYNH.TOHIEUQUIZ.EXAMPLE')).toBe('parent');
    expect(resolveHostContext('localhost', '?portal=parent')).toBe('parent');
    expect(resolveHostContext('localhost')).toBe('main');
    expect(resolveHostContext('tohieuquiz.example', '?portal=parent')).toBe('main');
  });
});

describe('ParentPortalApp routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('restores once and redirects unauthenticated protected routes to login', async () => {
    const restoreSession = vi.fn(async () => undefined);
    resetStore({ restoreSession });
    renderPortal('/dashboard');

    await waitFor(() => expect(screen.getByTestId('parent-location')).toHaveTextContent('/login'));
    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Đăng nhập phụ huynh' })).toBeInTheDocument();
  });

  it('redirects an authenticated parent away from login', async () => {
    resetStore({ session: student });
    renderPortal('/login');

    await waitFor(() => expect(screen.getByTestId('parent-location')).toHaveTextContent('/dashboard'));
    expect(screen.getByText('Tổng quan tuần')).toBeInTheDocument();
  });

  it('previews the linked student and activates with matching six-digit PINs', async () => {
    const activate = vi.fn(async () => {
      useParentPortalStore.setState({ session: student });
      return true;
    });
    resetStore({ activate });
    service.getParentActivation.mockResolvedValue({
      student: { fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' },
      expiresAt: '2026-07-29T00:00:00.000Z',
    });
    renderPortal('/activate?token=super-secret-token');

    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('Lớp 4A9')).toBeInTheDocument();
    expect(screen.queryByText('super-secret-token')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tạo PIN 6 số'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Nhập lại PIN'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt và đăng nhập' }));

    await waitFor(() => expect(activate).toHaveBeenCalledWith('super-secret-token', '123456'));
    await waitFor(() => expect(screen.getByTestId('parent-location')).toHaveTextContent('/dashboard'));
  });

  it('normalizes access code and uses a generic login error', async () => {
    const login = vi.fn(async () => false);
    resetStore({ login, error: 'Thông tin đăng nhập không đúng.' });
    renderPortal('/login');

    await screen.findByRole('heading', { name: 'Đăng nhập phụ huynh' });
    fireEvent.change(screen.getByLabelText('Mã phụ huynh'), { target: { value: ' abc defg234 ' } });
    fireEvent.change(screen.getByLabelText('PIN 6 số'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('ABCDEFG234', '654321'));
    expect(screen.getByText('Thông tin đăng nhập không đúng.')).toBeInTheDocument();
  });
});
