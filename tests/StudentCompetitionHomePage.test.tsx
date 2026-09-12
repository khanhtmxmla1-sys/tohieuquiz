import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentCompetitionPortalDto } from '../shared/competition-portal.contract';
import type {
  StudentCompetitionDetail,
  StudentCompetitionOfficialResult,
} from '../src/features/competition/studentCompetitionService';
import StudentCompetitionHomePage from '../src/features/competition/portal/student/StudentCompetitionHomePage';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  officialResult: vi.fn(),
  preflightSchoolExam: vi.fn(),
  start: vi.fn(),
  joinLiveExam: vi.fn(),
}));

vi.mock('../src/features/competition/studentCompetitionService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/studentCompetitionService')>(),
  studentCompetitionService: {
    get: mocks.get,
    officialResult: mocks.officialResult,
    start: mocks.start,
  },
}));

vi.mock('../src/features/competition/portal/studentCompetitionPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/portal/studentCompetitionPortalService')>(),
  studentCompetitionPortalService: {
    preflightSchoolExam: mocks.preflightSchoolExam,
  },
}));

vi.mock('../src/services/liveExamService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/services/liveExamService')>(),
  joinLiveExam: mocks.joinLiveExam,
}));

const portal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: Array.from({ length: 6 }, (_, index) => ({
    roundId: `round-${index + 1}`,
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '2026-09-01T00:00:00.000Z',
    closesAt: '2026-09-30T00:00:00.000Z',
    state: index === 0 ? 'PASSED' : index === 1 ? 'OPEN' : 'LOCKED',
    attemptCount: index === 0 ? 1 : 0,
    maxAttempts: 3,
  })),
  schoolExam: {
    qualified: true,
    eventId: 'school-exam-1',
    scheduledAt: '2026-10-10T08:00:00.000Z',
    roomName: 'Phòng A',
    ready: true,
  },
};

const competition: StudentCompetitionDetail = {
  id: portal.campaignId,
  title: portal.title,
  schoolYear: portal.schoolYear,
  status: 'ACTIVE',
  eligibility: { version: 2, qualified: true, reasonCodes: [] },
  rounds: portal.rounds.map((item, index) => ({
    id: item.roundId,
    roundNumber: item.roundNumber,
    maxAttempts: item.maxAttempts,
    passingScore: 70,
    status: index < 2 ? 'OPEN' : 'SCHEDULED',
    attemptsUsed: index === 0 ? 1 : 0,
    bestScore: index === 0 ? 90 : null,
    isPassed: index === 0,
    progressStatus: index === 0 ? 'PASSED' : null,
  })),
};

const officialResult: StudentCompetitionOfficialResult = {
  eventId: 'school-exam-1',
  eventTitle: 'School Exam',
  studentId: 'student-1',
  publicationVersion: 1,
  rankingVersion: 1,
  score: 92,
  correctCount: 23,
  timeTaken: 1200,
  rankEvent: 4,
  rankGrade: 2,
  rankClass: 1,
  publishedAt: '2026-10-12T00:00:00.000Z',
};

const renderPage = (context: StudentCompetitionPortalDto = portal) => render(
  <MemoryRouter initialEntries={[`/thi/${context.slug}`]}>
    <Routes>
      <Route path="/thi/:campaignSlug" element={<Outlet context={context} />}>
        <Route index element={<StudentCompetitionHomePage />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('StudentCompetitionHomePage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue(competition);
    mocks.officialResult.mockReset().mockRejectedValue(new Error('RESULT_NOT_PUBLISHED'));
    mocks.preflightSchoolExam.mockReset();
    mocks.start.mockReset();
    mocks.joinLiveExam.mockReset();
  });

  it('keeps an ordinary OPEN round actionable when canonical eligibility is absent', async () => {
    mocks.get.mockResolvedValue({ ...competition, eligibility: null });

    renderPage();

    expect(await screen.findByRole('link', { name: 'Vào thi vòng 2' })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/vong/2',
    );
  });

  it('preflights a qualified ready thi cấp trường without joining or starting an ordinary attempt', async () => {
    let resolvePreflight!: (value: {
      status: 'READY';
      campaignId: string;
      title: string;
      roomName: string;
      scheduledAt: string;
      serverTime: string;
      window: { opensAt: string; closesAt: string; timezone: string };
      accessCode: string;
    }) => void;
    mocks.preflightSchoolExam.mockReturnValue(new Promise(resolve => { resolvePreflight = resolve; }));
    renderPage();

    const action = await screen.findByRole('button', { name: /kiểm tra thi cấp trường/i });
    fireEvent.click(action);
    expect(screen.getByRole('status')).toHaveTextContent(/đang kiểm tra/i);

    resolvePreflight({
      status: 'READY',
      campaignId: portal.campaignId,
      title: 'Thi cấp trường',
      roomName: 'Phòng A',
      scheduledAt: portal.schoolExam!.scheduledAt,
      serverTime: '2026-10-10T07:55:00.000Z',
      window: {
        opensAt: '2026-10-10T07:45:00.000Z',
        closesAt: '2026-10-10T09:30:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      accessCode: 'ROOM-123',
    });

    const ready = await screen.findByText(/thi cấp trường sẵn sàng/i);
    expect(ready).toHaveTextContent(/sẵn sàng/i);
    expect(ready).toHaveTextContent('ROOM-123');
    expect(screen.getByRole('link', { name: 'VÀO THI CẤP TRƯỜNG' })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/school-exam/lam-bai',
    );
    expect(mocks.preflightSchoolExam).toHaveBeenCalledWith(portal.campaignId);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.joinLiveExam).not.toHaveBeenCalled();
  });

  it('shows a friendly thi cấp trường block reason returned by preflight', async () => {
    mocks.preflightSchoolExam.mockResolvedValue({
      status: 'BLOCKED',
      campaignId: portal.campaignId,
      reason: 'SCHOOL_EXAM_WINDOW_NOT_OPEN',
      serverTime: '2026-10-10T07:00:00.000Z',
      window: null,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /kiểm tra thi cấp trường/i }));

    expect(await screen.findByText(/chưa đến giờ vào thi cấp trường/i)).toBeInTheDocument();
    expect(screen.queryByText(/SCHOOL_EXAM_WINDOW_NOT_OPEN/)).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.joinLiveExam).not.toHaveBeenCalled();
  });

  it('shows a useful thi cấp trường preflight error without joining or starting', async () => {
    mocks.preflightSchoolExam.mockRejectedValue(new Error('NETWORK_ERROR'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /kiểm tra thi cấp trường/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/không thể kiểm tra thi cấp trường/i);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.joinLiveExam).not.toHaveBeenCalled();
  });

  it('renders canonical student status, exactly six rounds, a separate thi cấp trường card, and the next CTA', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: portal.title })).toBeInTheDocument();
    expect(screen.getByText('Đang diễn ra')).toBeInTheDocument();
    expect(screen.getByText('Em đủ điều kiện tham gia.')).toBeInTheDocument();

    const journey = screen.getByRole('region', { name: 'Hành trình 6 vòng thi' });
    expect(within(journey).getAllByRole('article')).toHaveLength(6);
    expect(within(journey).getByText('Đã vượt qua')).toBeInTheDocument();
    expect(within(journey).getByText('Đang mở')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào thi vòng 2' })).toHaveAttribute(
      'href',
      '/thi/olympic-toan/vong/2',
    );

    const schoolExam = screen.getByRole('region', { name: 'Thi cấp trường' });
    expect(schoolExam).toHaveTextContent('Phòng A');
    expect(within(journey).queryByText('Thi cấp trường')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bước tiếp theo' })).toHaveTextContent('Vào thi vòng 2');
    expect(mocks.get).toHaveBeenCalledWith(portal.campaignId);
    expect(mocks.officialResult).toHaveBeenCalledWith(portal.campaignId);
  });

  it('does not render an official-result card before canonical publication', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: portal.title });
    expect(screen.queryByRole('region', { name: 'Kết quả chính thức' })).not.toBeInTheDocument();
  });

  it('renders the official-result card after the canonical endpoint returns a publication', async () => {
    mocks.officialResult.mockResolvedValue(officialResult);

    renderPage();

    const result = await screen.findByRole('region', { name: 'Kết quả chính thức' });
    expect(result).toHaveTextContent('92');
    expect(result).toHaveTextContent('Hạng toàn trường: 4');
    expect(result).toHaveTextContent('Hạng khối: 2');
    expect(result).toHaveTextContent('Hạng lớp: 1');
  });

  it('explains the next step when eligibility is blocked instead of presenting an action', async () => {
    mocks.get.mockResolvedValue({
      ...competition,
      status: 'ELIGIBILITY_LOCKED',
      eligibility: { version: 2, qualified: false, reasonCodes: ['ELIGIBILITY_BLOCKED'] },
    });

    renderPage();

    expect(await screen.findByRole('region', { name: 'Bước tiếp theo' })).toHaveTextContent(
      /chờ giáo viên cập nhật điều kiện/i,
    );
    expect(screen.queryByRole('link', { name: 'Vào thi vòng 2' })).not.toBeInTheDocument();
  });

  it('guides an audience member with unknown eligibility to wait for the first round when the campaign is upcoming', async () => {
    const upcomingPortal: StudentCompetitionPortalDto = {
      ...portal,
      publicState: 'UPCOMING',
      rounds: portal.rounds.map(round => ({ ...round, state: 'LOCKED' })),
    };
    const scheduledCompetition: StudentCompetitionDetail = {
      ...competition,
      eligibility: null,
      rounds: competition.rounds.map(round => ({
        ...round,
        status: 'SCHEDULED',
        attemptsUsed: 0,
        bestScore: null,
        isPassed: false,
        progressStatus: null,
      })),
    };
    mocks.get.mockResolvedValue(scheduledCompetition);

    renderPage(upcomingPortal);

    const nextStep = await screen.findByRole('region', { name: 'Bước tiếp theo' });
    expect(nextStep).toHaveTextContent(/chờ vòng đầu tiên mở/i);
    expect(nextStep).not.toHaveTextContent(/giáo viên|kiểm tra lại thông tin/i);
  });

  it('guides an eligible-status-unknown student to wait for the next round when no round is actionable', async () => {
    const scheduledCompetition: StudentCompetitionDetail = {
      ...competition,
      eligibility: null,
      rounds: competition.rounds.map(round => ({
        ...round,
        status: round.roundNumber === 1 ? 'COMPLETED' : 'SCHEDULED',
        attemptsUsed: round.roundNumber === 1 ? 1 : 0,
        bestScore: round.roundNumber === 1 ? 90 : null,
        isPassed: round.roundNumber === 1,
        progressStatus: round.roundNumber === 1 ? 'PASSED' : null,
      })),
    };
    mocks.get.mockResolvedValue(scheduledCompetition);

    renderPage();

    const nextStep = await screen.findByRole('region', { name: 'Bước tiếp theo' });
    expect(nextStep).toHaveTextContent(/chờ vòng tiếp theo mở/i);
    expect(nextStep).not.toHaveTextContent(/giáo viên|kiểm tra lại thông tin/i);
  });
});
