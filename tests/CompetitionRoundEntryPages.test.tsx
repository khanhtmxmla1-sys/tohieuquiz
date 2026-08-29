import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentCompetitionPortalDto } from '../shared/competition-portal.contract';
import { AppRoutes } from '../src/app/AppRoutes';
import { useClassroomStore } from '../src/stores/useClassroomStore';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  callApi: vi.fn(),
  preflightResult: null as Record<string, unknown> | null,
  preflightError: null as Error | null,
}));

vi.mock('../src/config/featureFlags', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/config/featureFlags')>(),
  isCompetitionV1Enabled: () => true,
  isCompetitionStudentPortalUxEnabled: () => true,
  isCompetitionLegacyRedirectUxEnabled: () => false,
}));

vi.mock('../src/features/competition/studentCompetitionService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/studentCompetitionService')>(),
  studentCompetitionService: {
    get: mocks.get,
  },
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));

vi.mock('../src/features/competition/portal/student/CompetitionRoundExamPlayer', () => ({
  default: () => <div>student-competition-portal</div>,
}));

const portal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: [{
    roundId: 'round-2',
    roundNumber: 2,
    title: 'Vòng 2 — Tăng tốc',
    opensAt: '2026-09-02T01:00:00.000Z',
    closesAt: '2026-09-30T10:00:00.000Z',
    state: 'OPEN',
    attemptCount: 1,
    maxAttempts: 3,
  }],
};

const competition = {
  id: portal.campaignId,
  title: portal.title,
  status: 'ACTIVE',
  eligibility: { version: 1, qualified: true, reasonCodes: [] },
  rounds: [{
    id: 'round-2',
    roundNumber: 2,
    opensAt: portal.rounds[0].opensAt,
    closesAt: portal.rounds[0].closesAt,
    maxAttempts: 3,
    passingScore: 70,
    status: 'OPEN',
    attemptsUsed: 1,
    bestScore: 62,
    isPassed: false,
    answerKey: ['must-not-render'],
    quizSnapshot: { hiddenQuestion: 'must-not-render' },
  }],
};

const publicDetail = {
  slug: portal.slug,
  title: portal.title,
  summary: 'Cuộc thi Toán',
  schoolYear: portal.schoolYear,
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-01T00:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: portal.title },
  cta: { label: 'Tham gia' },
  rounds: portal.rounds,
  articleSummaryAvailable: true,
  articles: [
    {
      slug: 'quy-che-2026',
      title: 'Quy chế cuộc thi 2026',
      summary: 'Quy định áp dụng',
      content: 'Mỗi học sinh tự làm bài và tuân thủ thời gian của vòng thi.',
      type: 'RULES',
      publishedAt: '2026-08-20T00:00:00.000Z',
    },
    {
      slug: 'huong-dan',
      title: 'Hướng dẫn không phải quy chế',
      summary: 'Hướng dẫn',
      content: 'Nội dung hướng dẫn riêng.',
      type: 'GUIDE',
      publishedAt: '2026-08-21T00:00:00.000Z',
    },
  ],
};

vi.mock('../src/app/lazyViews', () => ({
  AboutPage: () => <div>about-page</div>,
  CompetitionStudentRoute: () => <Outlet context={portal} />,
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
  return <output aria-label="current-path">{location.pathname}</output>;
};

const renderEntryFlow = (initialPath: string) => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <LocationProbe />
    <AppRoutes giftShopEnabled sessionsReady />
  </MemoryRouter>,
);

const calledApiActions = () => mocks.callApi.mock.calls.map(([action]) => action);
const expectNoAttemptStart = () => {
  expect(calledApiActions()).not.toContain('start_student_competition_round_attempt');
};

describe('competition round entry pages', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useClassroomStore.setState({ studentSession, isLoading: false, error: null });
    mocks.get.mockReset().mockResolvedValue(competition);
    mocks.preflightResult = null;
    mocks.preflightError = null;
    mocks.callApi.mockReset().mockImplementation(async (action: string) => {
      if (action === 'get_public_competition') return publicDetail;
      if (action === 'preflight_student_competition_round') {
        if (mocks.preflightError) throw mocks.preflightError;
        return { preflight: mocks.preflightResult };
      }
      throw new Error(`Unexpected API action: ${action}`);
    });
  });

  it('shows safe canonical round data and routes VÀO THI to rules without starting an attempt', async () => {
    renderEntryFlow('/thi/olympic-toan/vong/2');

    expect(await screen.findByRole('heading', { name: 'Vòng 2 — Tăng tốc' })).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Ho_Chi_Minh/)).toBeInTheDocument();
    expect(screen.getByText(/02\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/30\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Điểm đạt.*70/)).toBeInTheDocument();
    expect(screen.getByText(/Đã dùng.*1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/Còn lại.*2/)).toBeInTheDocument();
    expect(screen.getByText(/Điểm tốt nhất.*62/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'VÀO THI' })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/vong/2/quy-che',
    );
    expect(screen.queryByText(/must-not-render/)).not.toBeInTheDocument();
    expect(mocks.callApi).toHaveBeenCalledWith('get_public_competition', { slug: 'olympic-toan' });
    expect(calledApiActions()).not.toContain('preflight_student_competition_round');
    expectNoAttemptStart();
  });

  it('renders applicable published RULES and acknowledgment only enables navigation to preflight', async () => {
    renderEntryFlow('/thi/olympic-toan/vong/2/quy-che');

    expect(await screen.findByRole('heading', { name: 'Quy chế cuộc thi 2026' })).toBeInTheDocument();
    expect(screen.getByText(/Mỗi học sinh tự làm bài/)).toBeInTheDocument();
    expect(screen.queryByText('Hướng dẫn không phải quy chế')).not.toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: 'TIẾP TỤC KIỂM TRA' });
    expect(continueButton).toBeDisabled();
    expect(calledApiActions()).not.toContain('preflight_student_competition_round');
    expectNoAttemptStart();

    fireEvent.click(screen.getByRole('checkbox', { name: /đã đọc và đồng ý/i }));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    await waitFor(() => expect(screen.getByLabelText('current-path')).toHaveTextContent(
      '/thi/olympic-toan/vong/2/kiem-tra',
    ));
    expect(mocks.callApi).toHaveBeenCalledWith('get_public_competition', { slug: 'olympic-toan' });
    expectNoAttemptStart();
  });

  it('requires the session-scoped rules acknowledgment before running preflight', () => {
    renderEntryFlow('/thi/olympic-toan/vong/2/kiem-tra');

    expect(screen.getByRole('alert')).toHaveTextContent(/cần xác nhận quy chế/i);
    expect(screen.getByRole('link', { name: /quay lại quy chế/i })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/vong/2/quy-che',
    );
    expect(calledApiActions()).not.toContain('preflight_student_competition_round');
    expectNoAttemptStart();
  });

  it('uses canonical portal ids for non-mutating READY preflight and shows an explicit start CTA', async () => {
    sessionStorage.setItem('competition-rules:campaign-1:round-2', 'acknowledged');
    mocks.preflightResult = {
      status: 'READY',
      campaignId: portal.campaignId,
      roundId: 'round-2',
      quizId: 'quiz-2',
      serverTime: '2026-09-10T01:00:00.000Z',
      window: {
        opensAt: portal.rounds[0].opensAt,
        closesAt: portal.rounds[0].closesAt,
        timezone: 'Asia/Ho_Chi_Minh',
      },
      attemptsRemaining: 2,
    };

    renderEntryFlow('/thi/olympic-toan/vong/2/kiem-tra');

    expect(await screen.findByText(/Sẵn sàng vào thi/i)).toBeInTheDocument();
    expect(mocks.callApi).toHaveBeenCalledWith('preflight_student_competition_round', {
      campaignId: 'campaign-1',
      roundId: 'round-2',
    });
    expect(screen.getByText(/Asia\/Ho_Chi_Minh/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BẮT ĐẦU' })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/vong/2/lam-bai',
    );
    expectNoAttemptStart();
  });

  it('renders a human-readable, non-color-only BLOCKED reason', async () => {
    sessionStorage.setItem('competition-rules:campaign-1:round-2', 'acknowledged');
    mocks.preflightResult = {
      status: 'BLOCKED',
      campaignId: portal.campaignId,
      roundId: 'round-2',
      reason: 'ATTEMPT_LIMIT_REACHED',
      serverTime: '2026-09-10T01:00:00.000Z',
      window: null,
      attemptsRemaining: 0,
    };

    renderEntryFlow('/thi/olympic-toan/vong/2/kiem-tra');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Đã hết số lượt thi cho phép');
    expect(alert).toHaveTextContent('Không thể vào thi');
    expect(screen.queryByRole('link', { name: 'BẮT ĐẦU' })).not.toBeInTheDocument();
    expectNoAttemptStart();
  });

  it('shows a transient network error distinctly from an ineligible response', async () => {
    sessionStorage.setItem('competition-rules:campaign-1:round-2', 'acknowledged');
    mocks.preflightError = new Error('NETWORK_ERROR');

    renderEntryFlow('/thi/olympic-toan/vong/2/kiem-tra');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Không thể kết nối để kiểm tra/i);
    expect(alert).toHaveTextContent(/thử lại/i);
    expect(alert).not.toHaveTextContent(/không đủ điều kiện/i);
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expectNoAttemptStart();
  });

  it('retains the legacy exam player only on the canonical lam-bai route', async () => {
    renderEntryFlow('/thi/olympic-toan/vong/2/lam-bai');

    expect(await screen.findByText('student-competition-portal')).toBeInTheDocument();
    expect(screen.getByLabelText('current-path')).toHaveTextContent('/thi/olympic-toan/vong/2/lam-bai');
  });
});
