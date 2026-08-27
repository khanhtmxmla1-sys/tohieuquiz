import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { useClassroomStore } from '../src/stores/useClassroomStore';

const mocks = vi.hoisted(() => ({
  legacyRedirectEnabled: false,
  studentPortalEnabled: true,
  campaigns: [] as Array<Record<string, unknown>>,
  portal: {
    campaignId: 'campaign-a',
    slug: 'campaign-a',
    title: 'Campaign A',
    schoolYear: '2026-2027',
    publicState: 'ONGOING',
    rounds: [],
    schoolExam: null,
  },
}));

vi.mock('../src/config/featureFlags', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/config/featureFlags')>(),
  isCompetitionV1Enabled: () => true,
  isCompetitionStudentPortalUxEnabled: () => mocks.studentPortalEnabled,
  isCompetitionLegacyRedirectUxEnabled: () => mocks.legacyRedirectEnabled,
}));

vi.mock('../src/features/competition/studentCompetitionService', () => ({
  studentCompetitionService: {
    get: vi.fn(() => new Promise(() => undefined)),
    list: vi.fn(async () => mocks.campaigns),
    officialResult: vi.fn(() => new Promise(() => undefined)),
  },
}));

vi.mock('../src/features/competition/portal/student/StudentRoundPage', () => ({
  default: () => <div>student-round-page</div>,
}));

vi.mock('../src/features/competition/portal/student/StudentRoundRulesPage', () => ({
  default: () => <div>student-round-rules-page</div>,
}));

vi.mock('../src/features/competition/portal/student/StudentRoundPreflightPage', () => ({
  default: () => <div>student-round-preflight-page</div>,
}));

vi.mock('../src/app/lazyViews', () => ({
  AboutPage: () => <div>about-page</div>,
  CompetitionStudentRoute: () => <Outlet context={mocks.portal} />,
  ContactPage: () => <div>contact-page</div>,
  DesignSystemPage: () => <div>design-system-page</div>,
  GiftShop: () => <div>student-shop</div>,
  LoginLandingPage: () => <div>login-landing-page</div>,
  ManualQuizWorkspacePage: () => <div>manual-workspace</div>,
  PhieuPublicPage: () => <div>phieu-public-page</div>,
  PrivacyPolicy: () => <div>privacy-page</div>,
  StudentCompetitionPage: () => <div>student-competition-portal</div>,
  StudentCompetitionHomePage: () => <div>student-competition-home</div>,
  StudentDashboardUI: () => <div>student-dashboard</div>,
  TeacherDashboard: () => <div>teacher-dashboard</div>,
  TeacherResultDetailPage: () => <div>teacher-result-detail</div>,
  TermsOfService: () => <div>terms-page</div>,
}));

const studentSession = {
  studentId: 'student-1',
  username: 'student.one',
  fullName: 'Học sinh Một',
  classId: 'class-1',
  className: '4A',
} as any;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderRoutes = (entry: string) => render(
  <MemoryRouter initialEntries={[entry]}>
    <AppRoutes giftShopEnabled sessionsReady />
    <LocationProbe />
  </MemoryRouter>,
);

describe('Student Competition portal routing', () => {
  beforeEach(() => {
    mocks.legacyRedirectEnabled = false;
    mocks.studentPortalEnabled = true;
    mocks.campaigns = [];
    useClassroomStore.setState({ studentSession, isLoading: false, error: null });
  });

  it.each([
    ['/thi/campaign-a/vong/2', 'student-round-page'],
    ['/thi/campaign-a/vong/2/quy-che', 'student-round-rules-page'],
    ['/thi/campaign-a/vong/2/kiem-tra', 'student-round-preflight-page'],
    ['/thi/campaign-a/vong/2/lam-bai', 'student-competition-portal'],
  ])('renders %s outside StudentDashboardUI', async (path, expectedPage) => {
    renderRoutes(path);

    expect(await screen.findByText(expectedPage)).toBeInTheDocument();
    expect(screen.queryByText('student-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it('renders the Student campaign home at the campaign index only', async () => {
    renderRoutes('/thi/campaign-a');

    expect(await screen.findByText('student-competition-home')).toBeInTheDocument();
    expect(screen.queryByText('student-competition-portal')).not.toBeInTheDocument();
    expect(screen.queryByText('student-dashboard')).not.toBeInTheDocument();
  });

  it('keeps the canonical campaign URL but renders the compatibility dashboard when portal UX is disabled', async () => {
    mocks.studentPortalEnabled = false;

    renderRoutes('/thi/campaign-a');

    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('student-competition-portal')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/thi/campaign-a');
  });

  it('keeps the unrelated Student live-exam route unchanged', async () => {
    renderRoutes('/student/live-exam/session-1');

    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('student-competition-portal')).not.toBeInTheDocument();
  });

  it('preserves the old compatibility dashboard when the legacy redirect gate is disabled', async () => {
    renderRoutes('/student/competition');

    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/student/competition');
  });

  it('redirects one active campaign using its server-authoritative portal slug', async () => {
    mocks.legacyRedirectEnabled = true;
    mocks.campaigns = [{
      id: 'campaign-id-not-the-slug',
      title: 'Campaign title must not be slugified',
      status: 'ACTIVE',
      slug: 'server-authoritative-slug',
    }];

    renderRoutes('/student/competition');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/thi/server-authoritative-slug'));
  });

  it('keeps the legacy redirect gate independent when the Student portal UX gate is disabled', async () => {
    mocks.legacyRedirectEnabled = true;
    mocks.studentPortalEnabled = false;
    mocks.campaigns = [{
      id: 'campaign-id-not-the-slug',
      title: 'Campaign title must not be slugified',
      status: 'ACTIVE',
      slug: 'server-authoritative-slug',
    }];

    renderRoutes('/student/competition');

    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('student-competition-portal')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/thi/server-authoritative-slug');
  });

  it('preserves the compatibility dashboard when an active campaign has no canonical slug', async () => {
    mocks.legacyRedirectEnabled = true;
    mocks.campaigns = [{
      id: 'campaign-without-page',
      title: 'Campaign without a public page',
      status: 'ACTIVE',
      slug: null,
    }];

    renderRoutes('/student/competition');

    expect(await screen.findByText('student-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/student/competition');
  });

  it('renders a chooser when multiple active campaigns are available', async () => {
    mocks.legacyRedirectEnabled = true;
    mocks.campaigns = [
      { id: 'campaign-a', title: 'Campaign A', status: 'ACTIVE', slug: 'campaign-a-slug' },
      { id: 'campaign-b', title: 'Campaign B', status: 'ACTIVE', slug: 'campaign-b-slug' },
    ];

    renderRoutes('/student/competition');

    expect(await screen.findByRole('heading', { name: /chọn cuộc thi/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campaign A' })).toHaveAttribute('href', '/thi/campaign-a-slug');
    expect(screen.getByRole('link', { name: 'Campaign B' })).toHaveAttribute('href', '/thi/campaign-b-slug');
  });
});
