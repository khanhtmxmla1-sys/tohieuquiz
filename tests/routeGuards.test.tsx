import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import {
  getStudentRoute,
  getStudentSectionRoute,
  getTeacherRoute,
  resolveSafeReturnTo,
  resolveStudentSectionFromLocation,
  resolveTeacherTabFromLocation,
} from '../src/app/navigationRoutes';
import { useAuthStore } from '../stores/authStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';

vi.mock('../src/app/lazyViews', () => ({
  AboutPage: () => <div>about-page</div>,
  ContactPage: () => <div>contact-page</div>,
  DesignSystemPage: () => <div>design-system-page</div>,
  Footer: () => <div>footer</div>,
  GiftShop: () => <div>student-shop</div>,
  HomePage: () => <div>home-page</div>,
  ManualQuizWorkspacePage: () => <div>manual-workspace</div>,
  PhieuPublicPage: () => <div>phieu-public-page</div>,
  PrivacyPolicy: () => <div>privacy-page</div>,
  StudentDashboardUI: () => <div>student-dashboard</div>,
  TeacherDashboard: () => <div>teacher-dashboard</div>,
  TeacherResultDetailPage: () => <div>teacher-result-detail</div>,
  TermsOfService: () => <div>terms-page</div>,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderRoutes = (
  entry: string,
  sessionsReady = true,
  manualQuizWorkspaceEnabled = false,
) => render(
  <MemoryRouter initialEntries={[entry]}>
    <AppRoutes
      giftShopEnabled
      sessionsReady={sessionsReady}
      manualQuizWorkspaceEnabled={manualQuizWorkspaceEnabled}
    />
    <LocationProbe />
  </MemoryRouter>,
);

const studentSession = {
  studentId: 'student-1',
  username: 'student.one',
  fullName: 'Học sinh Một',
  classId: 'class-1',
  className: '4A',
} as any;

describe('URL navigation contracts', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'anonymous',
      isLoggedIn: false,
      username: null,
      teacherName: null,
      isAdmin: false,
      teacherClass: null,
    });
    useClassroomStore.setState({ studentSession: null, isLoading: false, error: null });
  });

  it('maps every primary teacher tab to a stable URL', () => {
    expect(getTeacherRoute('overview')).toBe('/teacher/overview');
    expect(getTeacherRoute('manage')).toBe('/teacher/quizzes');
    expect(getTeacherRoute('create')).toBe('/teacher/quizzes?mode=create');
    expect(getTeacherRoute('assignments')).toBe('/teacher/assignments');
    expect(getTeacherRoute('results')).toBe('/teacher/results');
    expect(getTeacherRoute('classes')).toBe('/teacher/classes');
    expect(getTeacherRoute('live-exam')).toBe('/teacher/live-exams');
    expect(getTeacherRoute('gift-shop')).toBe('/teacher/gift-shop');
    expect(resolveTeacherTabFromLocation('/teacher/quizzes', '?mode=create')).toBe('create');
    expect(resolveTeacherTabFromLocation('/teacher/unknown', '')).toBe('overview');
  });

  it('maps primary student destinations to stable URLs', () => {
    expect(getStudentRoute('dashboard')).toBe('/student/dashboard');
    expect(getStudentRoute('assignments')).toBe('/student/assignments');
    expect(getStudentRoute('practice')).toBe('/student/practice');
    expect(getStudentRoute('shop')).toBe('/student/shop');
    expect(getStudentRoute('liveExam', { sessionId: 'session 1' }))
      .toBe('/student/live-exam/session%201');
    expect(getStudentSectionRoute('achievements')).toBe('/student/achievements');
    expect(getStudentSectionRoute('resultReports')).toBe('/student/results');
    expect(resolveStudentSectionFromLocation('/student/achievements')).toBe('achievements');
    expect(resolveStudentSectionFromLocation('/student/results')).toBe('resultReports');
    expect(resolveStudentSectionFromLocation('/student/assignments')).toBe('dashboard');
  });

  it('allows only same-app role routes as returnTo targets', () => {
    expect(resolveSafeReturnTo('/teacher/results?page=2', 'teacher')).toBe('/teacher/results?page=2');
    expect(resolveSafeReturnTo('/student/practice/toan', 'student')).toBe('/student/practice/toan');
    expect(resolveSafeReturnTo('https://evil.example/teacher/results', 'teacher')).toBeNull();
    expect(resolveSafeReturnTo('//evil.example/teacher/results', 'teacher')).toBeNull();
    expect(resolveSafeReturnTo('/student/dashboard', 'teacher')).toBeNull();
    expect(resolveSafeReturnTo('/teacher/overview#token', 'teacher')).toBeNull();
  });

  it('waits for session restoration before deciding a protected route', () => {
    renderRoutes('/teacher/results?page=2', false);

    expect(screen.getByTestId('route-session-loading')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher/results?page=2');
    expect(screen.queryByText('teacher-dashboard')).not.toBeInTheDocument();
  });

  it('redirects an anonymous teacher deep link with an allowlisted returnTo', async () => {
    renderRoutes('/teacher/results?page=2&q=An');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?'));
    const search = screen.getByTestId('location').textContent?.split('?')[1] || '';
    const params = new URLSearchParams(search);
    expect(params.get('login')).toBe('teacher');
    expect(params.get('returnTo')).toBe('/teacher/results?page=2&q=An');
  });

  it('guards feature-enabled manual quiz workspace routes', async () => {
    renderRoutes('/teacher/quizzes/manual/new', true, true);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?'));
    const search = screen.getByTestId('location').textContent?.split('?')[1] || '';
    const params = new URLSearchParams(search);
    expect(params.get('login')).toBe('teacher');
    expect(params.get('returnTo')).toBe('/teacher/quizzes/manual/new');
    expect(screen.queryByText('manual-workspace')).not.toBeInTheDocument();
  });

  it('renders an authenticated teacher deep link without legacy view state', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isLoggedIn: true,
      username: 'teacher.one',
      teacherName: 'Giáo viên Một',
    });

    renderRoutes('/teacher/classes');

    expect(await screen.findByText('teacher-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher/classes');
  });

  it('redirects a non-admin teacher away from the internal design system', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isLoggedIn: true,
      username: 'teacher.one',
      teacherName: 'Giáo viên Một',
      isAdmin: false,
    });

    renderRoutes('/design-system');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/overview'));
    expect(screen.queryByText('design-system-page')).not.toBeInTheDocument();
  });

  it('renders the internal design system for an administrator', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isLoggedIn: true,
      username: 'admin.one',
      teacherName: 'Quản trị viên',
      isAdmin: true,
    });

    renderRoutes('/design-system');

    expect(await screen.findByText('design-system-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/design-system');
  });

  it('guards student routes and renders them after student restoration', async () => {
    const anonymousRender = renderRoutes('/student/assignments?page=3');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?'));
    const search = screen.getByTestId('location').textContent?.split('?')[1] || '';
    const params = new URLSearchParams(search);
    expect(params.get('login')).toBe('student');
    expect(params.get('returnTo')).toBe('/student/assignments?page=3');
    anonymousRender.unmount();

    useClassroomStore.setState({ studentSession });
    renderRoutes('/student/dashboard');
    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
  });
});
