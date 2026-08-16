import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginStudent = vi.hoisted(() => vi.fn());
const callApi = vi.hoisted(() => vi.fn());
const showError = vi.hoisted(() => vi.fn());

vi.mock('../src/services/apiAdapter', () => ({ callApi }));
vi.mock('../src/utils/toast', () => ({ showError }));
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    isLoggingIn: false,
    loginStart: vi.fn(),
    loginPendingPasswordChange: vi.fn(),
    loginSuccess: vi.fn(),
    loginFailure: vi.fn(),
  }),
}));
vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({ isLoading: false, loginStudent }),
}));
vi.mock('../src/services/passkeyService', () => ({
  authenticateTeacherWithPasskey: vi.fn(),
  passkeysSupported: () => false,
}));
vi.mock('../src/features/notifications/useUnifiedNotificationsFeatureFlag', () => ({
  useUnifiedNotificationsFeatureFlag: () => ({ ready: false, enabled: false }),
}));
vi.mock('../src/components/HomePage/components/LandingHeader', () => ({ default: () => <header>TôHiệuQuiz</header> }));
vi.mock('../src/components/HomePage/components/HeroSection', () => ({ default: () => <section data-testid="login-hero">Học vui mỗi ngày</section> }));
vi.mock('../src/components/HomePage/components/LandingFooter', () => ({ default: () => <footer>TôHiệuQuiz</footer> }));
vi.mock('../src/components/common/PasswordChangeDialog', () => ({ default: () => null }));

import LoginLandingPage from '../src/components/HomePage/LoginLandingPage';

const renderPage = (entry = '/') => render(
  <MemoryRouter initialEntries={[entry]}>
    <LoginLandingPage />
  </MemoryRouter>,
);
const usernameInput = () => screen.getByLabelText('Tên đăng nhập') as HTMLInputElement;
const passwordInput = () => screen.getByLabelText('Mật khẩu') as HTMLInputElement;

describe('login landing state integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    loginStudent.mockReset();
    loginStudent.mockResolvedValue(false);
    callApi.mockReset();
    showError.mockReset();
  });

  it('keeps student and teacher credential drafts isolated by role', () => {
    renderPage();
    fireEvent.change(usernameInput(), { target: { value: 'student.one' } });
    fireEvent.change(passwordInput(), { target: { value: 'student-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giáo viên' }));
    expect(usernameInput()).toHaveValue('');
    expect(passwordInput()).toHaveValue('');

    fireEvent.change(usernameInput(), { target: { value: 'teacher.one' } });
    fireEvent.change(passwordInput(), { target: { value: 'teacher-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Học sinh' }));
    expect(usernameInput()).toHaveValue('student.one');
    expect(passwordInput()).toHaveValue('student-secret');
  });

  it('restores remembered usernames independently and never persists passwords', async () => {
    loginStudent.mockResolvedValue(true);
    callApi.mockResolvedValue({ status: 'success', data: { username: 'teacher.one', fullName: 'Teacher One', role: 'teacher' } });

    const first = renderPage();
    fireEvent.change(usernameInput(), { target: { value: 'student.one' } });
    fireEvent.change(passwordInput(), { target: { value: 'student-secret' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' }));
    await waitFor(() => expect(loginStudent).toHaveBeenCalledWith({ username: 'student.one', password: 'student-secret' }));

    fireEvent.click(screen.getByRole('button', { name: 'Giáo viên' }));
    fireEvent.change(usernameInput(), { target: { value: 'teacher.one' } });
    fireEvent.change(passwordInput(), { target: { value: 'teacher-secret' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' }));
    await waitFor(() => expect(callApi).toHaveBeenCalledWith('login', { username: 'teacher.one', password: 'teacher-secret' }));

    const persisted = localStorage.getItem('tohieuquiz_saved_login_v1') || '';
    expect(persisted).toContain('student.one');
    expect(persisted).toContain('teacher.one');
    expect(persisted).not.toContain('student-secret');
    expect(persisted).not.toContain('teacher-secret');

    first.unmount();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Giáo viên' })).toHaveAttribute('aria-pressed', 'true'));
    expect(usernameInput()).toHaveValue('teacher.one');
    expect(passwordInput()).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Học sinh' }));
    expect(usernameInput()).toHaveValue('student.one');
    expect(passwordInput()).toHaveValue('');
  });

  it('renders the login form before the supporting hero in DOM order', () => {
    renderPage();
    const formSection = screen.getByRole('region', { name: 'Chào mừng bạn trở lại' });
    const hero = screen.getByTestId('login-hero');
    expect(formSection.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows inline validation and backend errors while retaining toast feedback', async () => {
    renderPage('/?login=teacher');
    fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' }));
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Vui lòng nhập tên đăng nhập.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
    expect(showError).toHaveBeenCalledWith('Vui lòng nhập đầy đủ thông tin!');

    fireEvent.change(usernameInput(), { target: { value: 'teacher.bad' } });
    fireEvent.change(passwordInput(), { target: { value: 'wrong' } });
    callApi.mockResolvedValue({ status: 'error', message: 'Sai thông tin đăng nhập.' });
    fireEvent.submit(screen.getByRole('form', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sai thông tin đăng nhập.');
    expect(showError).toHaveBeenCalledWith('Sai thông tin đăng nhập.');
  });
});
