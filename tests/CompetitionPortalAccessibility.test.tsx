import React from 'react';
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicCompetitionDetailDto,
  StaffCompetitionPublicPageDto,
  StudentCompetitionPortalDto,
} from '../shared/competition-portal.contract';
import type {
  StudentCompetitionDetail,
} from '../src/features/competition/studentCompetitionService';
import CompetitionCampaignPage from '../src/features/competition/portal/public/CompetitionCampaignPage';
import PublicPageEditor from '../src/features/competition/public-content/PublicPageEditor';
import CompetitionRoundExamPlayer from '../src/features/competition/portal/student/CompetitionRoundExamPlayer';
import StudentCompetitionHomePage from '../src/features/competition/portal/student/StudentCompetitionHomePage';
import StudentRoundPreflightPage from '../src/features/competition/portal/student/StudentRoundPreflightPage';

const mocks = vi.hoisted(() => ({
  getCompetition: vi.fn(),
  getStudentCompetition: vi.fn(),
  officialResult: vi.fn(),
  preflightRound: vi.fn(),
  getPublicPage: vi.fn(),
  previewPublicPage: vi.fn(),
  publishPublicPage: vi.fn(),
  archivePublicPage: vi.fn(),
  updatePublicPage: vi.fn(),
  useCompetitionRoundAttempt: vi.fn(),
}));

vi.mock('../src/features/competition/portal/public/publicCompetitionPortalService', async importOriginal => ({
  ...await importOriginal<typeof import('../src/features/competition/portal/public/publicCompetitionPortalService')>(),
  publicCompetitionPortalService: {
    getCompetition: mocks.getCompetition,
  },
}));

vi.mock('../src/features/competition/studentCompetitionService', async importOriginal => ({
  ...await importOriginal<typeof import('../src/features/competition/studentCompetitionService')>(),
  studentCompetitionService: {
    get: mocks.getStudentCompetition,
    officialResult: mocks.officialResult,
  },
}));

vi.mock('../src/features/competition/portal/studentCompetitionPortalService', async importOriginal => ({
  ...await importOriginal<typeof import('../src/features/competition/portal/studentCompetitionPortalService')>(),
  studentCompetitionPortalService: {
    preflightRound: mocks.preflightRound,
  },
}));

vi.mock('../src/features/competition/public-content/competitionPublicContentService', async importOriginal => ({
  ...await importOriginal<typeof import('../src/features/competition/public-content/competitionPublicContentService')>(),
  competitionPublicContentService: {
    getPublicPage: mocks.getPublicPage,
    previewPublicPage: mocks.previewPublicPage,
    publishPublicPage: mocks.publishPublicPage,
    archivePublicPage: mocks.archivePublicPage,
    updatePublicPage: mocks.updatePublicPage,
  },
}));

vi.mock('../src/features/competition/portal/student/useCompetitionRoundAttempt', () => ({
  useCompetitionRoundAttempt: mocks.useCompetitionRoundAttempt,
}));

const publicRounds = Array.from({ length: 6 }, (_, index) => ({
  roundNumber: index + 1,
  title: `Vòng ${index + 1}`,
  opensAt: '2026-09-01T00:00:00.000Z',
  closesAt: '2026-09-30T00:00:00.000Z',
  state: index === 0 ? 'OPEN' as const : 'LOCKED' as const,
}));

const publicCompetition: PublicCompetitionDetailDto = {
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  summary: 'Sân chơi học tập dành cho học sinh.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-30T00:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: 'Chinh phục thử thách Toán học', subtitle: 'Sáu vòng thi dành cho em.' },
  cta: { label: 'VÀO THI' },
  rounds: publicRounds,
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
  articles: [{
    slug: 'the-le',
    title: 'Thể lệ cuộc thi',
    summary: 'Thông tin thể lệ.',
    content: 'Nội dung thể lệ.',
    type: 'RULES',
    publishedAt: '2026-08-20T00:00:00.000Z',
  }],
};

const studentPortal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: publicRounds.map((round, index) => ({
    ...round,
    roundId: `round-${index + 1}`,
    attemptCount: 0,
    maxAttempts: 3,
  })),
};

const studentCompetition: StudentCompetitionDetail = {
  id: studentPortal.campaignId,
  title: studentPortal.title,
  schoolYear: studentPortal.schoolYear,
  status: 'ACTIVE',
  eligibility: { version: 1, qualified: true, reasonCodes: [] },
  rounds: studentPortal.rounds.map((round, index) => ({
    id: round.roundId,
    roundNumber: round.roundNumber,
    maxAttempts: round.maxAttempts,
    passingScore: 70,
    status: index === 0 ? 'OPEN' : 'SCHEDULED',
    attemptsUsed: 0,
    bestScore: null,
    isPassed: false,
    progressStatus: null,
  })),
};

const staffPage: StaffCompetitionPublicPageDto = {
  id: 'public-page-1',
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  status: 'PREVIEW',
  heroTitle: 'Chinh phục thử thách Toán học',
  heroSubtitle: 'Sáu vòng thi dành cho em.',
  heroImageUrl: null,
  summary: 'Sân chơi học tập dành cho học sinh.',
  ctaLabel: 'VÀO THI',
  seoTitle: 'Olympic Toán 2026',
  seoDescription: 'Thông tin cuộc thi.',
  ogImageUrl: null,
  publishedAt: null,
  archivedAt: null,
  createdBy: 'admin-1',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedBy: 'admin-1',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

const renderStudentRoute = (path: string, element: React.ReactElement) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/thi/:campaignSlug" element={<Outlet context={studentPortal} />}>
        <Route path="vong/:roundNumber/*" element={element} />
        <Route index element={element} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

const renderCampaign = () => render(
  <MemoryRouter initialEntries={['/cuoc-thi/olympic-toan']}>
    <Routes>
      <Route path="/cuoc-thi/:campaignSlug" element={<CompetitionCampaignPage />} />
    </Routes>
  </MemoryRouter>,
);

const runAxe = async (container: HTMLElement) => {
  const report = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } },
  });
  const serious = report.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
};

const assertVisibleFocusTreatment = (container: HTMLElement) => {
  const interactive = Array.from(container.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select'))
    .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
  const missing = interactive.filter(element => {
    const className = element.getAttribute('class') ?? '';
    return !className.includes('focus-visible:') && !className.includes('focus:not-sr-only');
  });
  expect(missing.map(element => element.getAttribute('aria-label') || element.textContent?.trim())).toEqual([]);
};

const assertHeadingOrder = (container: HTMLElement) => {
  const levels = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(heading => Number(heading.tagName.slice(1)));
  expect(levels[0]).toBe(1);
  expect(levels.filter(level => level === 1)).toHaveLength(1);
  levels.slice(1).forEach((level, index) => {
    expect(level, `heading ${index + 2} follows h${levels[index]}`).toBeLessThanOrEqual(levels[index] + 1);
  });
};

const assertStatusMessagesHaveText = (container: HTMLElement) => {
  const messages = Array.from(container.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]'));
  messages.forEach(message => {
    expect(message.textContent?.trim()).not.toBe('');
    expect(message).not.toHaveAttribute('aria-hidden', 'true');
  });
};

describe('Competition portal accessibility contract', () => {
  beforeEach(() => {
    mocks.getCompetition.mockReset().mockResolvedValue(publicCompetition);
    mocks.getStudentCompetition.mockReset().mockResolvedValue(studentCompetition);
    mocks.officialResult.mockReset().mockRejectedValue(new Error('RESULT_NOT_PUBLISHED'));
    mocks.preflightRound.mockReset().mockResolvedValue({
      status: 'READY',
      campaignId: studentPortal.campaignId,
      roundId: studentPortal.rounds[0].roundId,
      quizId: 'quiz-1',
      serverTime: '2026-09-01T01:00:00.000Z',
      window: {
        opensAt: '2026-09-01T00:00:00.000Z',
        closesAt: '2026-09-30T00:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      attemptsRemaining: 3,
    });
    mocks.getPublicPage.mockReset().mockResolvedValue(staffPage);
    mocks.previewPublicPage.mockReset().mockResolvedValue(staffPage);
    mocks.publishPublicPage.mockReset().mockResolvedValue({ ...staffPage, status: 'PUBLISHED' });
    mocks.archivePublicPage.mockReset().mockResolvedValue({ ...staffPage, status: 'ARCHIVED' });
    mocks.updatePublicPage.mockReset().mockResolvedValue(staffPage);
    mocks.useCompetitionRoundAttempt.mockReset().mockReturnValue({
      active: {
        attempt: { id: 'attempt-1', campaignId: 'campaign-1', roundId: 'round-1', startedAt: '2026-09-01T01:00:00.000Z' },
        quiz: { id: 'quiz-1', title: 'Đề vòng 1', timeLimit: 30, questions: [] },
        draftIdentity: 'competition:attempt-1:quiz-1',
      },
      answers: {},
      currentPage: 1,
      error: null,
      pending: false,
      submitting: false,
      result: null,
      start: vi.fn(),
      submit: vi.fn(),
      answerQuestion: vi.fn(),
      matchQuestion: vi.fn(),
      setCurrentPage: vi.fn(),
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('keeps the public campaign shell and content heading hierarchy accessible', async () => {
    const { container } = renderCampaign();

    await screen.findByRole('heading', { level: 1, name: publicCompetition.title });
    expect(screen.getByRole('link', { name: 'Bỏ qua đến nội dung cuộc thi' })).toHaveAttribute(
      'href',
      '#competition-public-main',
    );
    expect(document.getElementById('competition-public-main')).toBeInTheDocument();
    assertHeadingOrder(container);
    assertVisibleFocusTreatment(container);
    assertStatusMessagesHaveText(container);
    await runAxe(container);
  });

  it('gives the student competition home page live status semantics and visible focus treatment', async () => {
    const { container } = renderStudentRoute('/thi/olympic-toan', <StudentCompetitionHomePage />);

    await screen.findByRole('heading', { level: 1, name: studentPortal.title });
    assertVisibleFocusTreatment(container);
    assertStatusMessagesHaveText(container);
    await runAxe(container);
  });

  it('announces student competition home loading status politely', () => {
    mocks.getStudentCompetition.mockReturnValue(new Promise(() => undefined));
    mocks.officialResult.mockReturnValue(new Promise(() => undefined));

    renderStudentRoute('/thi/olympic-toan', <StudentCompetitionHomePage />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    assertStatusMessagesHaveText(document.body);
  });

  it('announces preflight loading and keeps the entry CTA keyboard-visible', async () => {
    sessionStorage.setItem('competition-rules:campaign-1:round-1', 'acknowledged');
    let resolvePreflight!: (value: unknown) => void;
    mocks.preflightRound.mockReturnValue(new Promise(resolve => { resolvePreflight = resolve; }));

    const { container } = renderStudentRoute(
      '/thi/olympic-toan/vong/1/kiem-tra',
      <StudentRoundPreflightPage />,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    resolvePreflight({
      status: 'READY',
      campaignId: studentPortal.campaignId,
      roundId: 'round-1',
      quizId: 'quiz-1',
      serverTime: '2026-09-01T01:00:00.000Z',
      window: {
        opensAt: '2026-09-01T00:00:00.000Z',
        closesAt: '2026-09-30T00:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      attemptsRemaining: 3,
    });
    await screen.findByRole('link', { name: 'BẮT ĐẦU' });
    assertVisibleFocusTreatment(container);
    await runAxe(container);
  });

  it('keeps the active player keyboard navigable, labels the timer without a noisy live region, and exposes reduced-motion support', async () => {
    const { container } = renderStudentRoute(
      '/thi/olympic-toan/vong/1/lam-bai',
      <CompetitionRoundExamPlayer />,
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(screen.getByLabelText(/Thời gian còn lại/)).not.toHaveAttribute('aria-live');
    expect(container.querySelector('[class*="motion-reduce:"]')).toBeInTheDocument();
    expect(screen.getAllByRole('status').every(status => status.getAttribute('aria-live') === 'polite')).toBe(true);
    assertVisibleFocusTreatment(container);
    assertStatusMessagesHaveText(container);
    const playerFocusables = Array.from(main.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select'));
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    playerFocusables.at(-1)?.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
    await runAxe(container);
  });

  it('labels and focus-manages staff confirmation dialogs without trapping player navigation', async () => {
    render(
      <MemoryRouter>
        <PublicPageEditor campaignId="campaign-1" isAdmin />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole('button', { name: 'Công bố trang công khai' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận công bố' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    const dialogButtons = within(dialog).getAllByRole('button');
    const first = dialogButtons[0];
    const last = dialogButtons[dialogButtons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab', code: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    expect(dialogButtons.every(button => {
      const className = button.getAttribute('class') ?? '';
      return className.includes('focus-visible:');
    })).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
