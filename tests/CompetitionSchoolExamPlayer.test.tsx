import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentCompetitionPortalDto } from '../shared/competition-portal.contract';
import { ProtectedRoute } from '../src/app/ProtectedRoute';
import { useAuthStore } from '../stores/authStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';

const mocks = vi.hoisted(() => ({
  preflightSchoolExam: vi.fn(),
  startRoundAttempt: vi.fn(),
  joinLiveExam: vi.fn(),
  controllerJoin: vi.fn(),
  controller: {
    joinedExam: null as null | { sessionId: string },
    stage: 'waiting',
  } as any,
}));

vi.mock('../src/features/competition/portal/studentCompetitionPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/portal/studentCompetitionPortalService')>(),
  studentCompetitionPortalService: {
    preflightSchoolExam: mocks.preflightSchoolExam,
    startRoundAttempt: mocks.startRoundAttempt,
  },
}));

vi.mock('../src/services/liveExamService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/services/liveExamService')>(),
  joinLiveExam: mocks.joinLiveExam,
}));

vi.mock('../src/features/student-dashboard/hooks/useStudentLiveExam', () => ({
  useStudentLiveExam: () => mocks.controller,
}));

vi.mock('../src/features/student-dashboard/components/StudentLiveExamScreen', () => ({
  StudentLiveExamScreen: ({ controller }: { controller: { stage: string } }) => (
    <div>canonical-live-exam-{controller.stage}</div>
  ),
}));

import CompetitionSchoolExamPlayer from '../src/features/competition/portal/student/CompetitionSchoolExamPlayer';

const EMBARGO_MESSAGE = 'Bài thi đã được ghi nhận. Kết quả chính thức sẽ được công bố sau khi Ban tổ chức hoàn tất đối soát.';

const portal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: [],
  schoolExam: {
    qualified: true,
    eventId: 'event-1',
    scheduledAt: '2026-10-10T08:00:00.000Z',
    roomName: 'Phòng A',
    ready: true,
  },
};

const readyPreflight = {
  status: 'READY' as const,
  campaignId: portal.campaignId,
  title: 'School Exam',
  roomName: 'Phòng A',
  scheduledAt: '2026-10-10T08:00:00.000Z',
  serverTime: '2026-10-10T07:55:00.000Z',
  window: {
    opensAt: '2026-10-10T07:45:00.000Z',
    closesAt: '2026-10-10T09:30:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  accessCode: 'ABC123',
};

const joinedSession = {
  id: 'live-school-1',
  title: 'School Exam',
  quizId: 'quiz-1',
  duration: 60,
  status: 'waiting',
};

const renderPlayer = () => render(
  <MemoryRouter initialEntries={['/thi/olympic-toan/school-exam/lam-bai']}>
    <Routes>
      <Route path="/thi/:campaignSlug/school-exam" element={<Outlet context={portal} />}>
        <Route path="lam-bai" element={<CompetitionSchoolExamPlayer />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

describe('CompetitionSchoolExamPlayer', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.preflightSchoolExam.mockReset().mockResolvedValue(readyPreflight);
    mocks.startRoundAttempt.mockReset();
    mocks.joinLiveExam.mockReset().mockResolvedValue({ participant: {}, session: joinedSession });
    mocks.controllerJoin.mockReset();
    mocks.controller = {
      joinedExam: null,
      joinedQuiz: null,
      questions: [],
      stage: 'waiting',
      status: null,
      submission: null,
      isPreparing: false,
      loadError: null,
      shouldRenderScreen: false,
      isJoinModalOpen: false,
      openJoinModal: vi.fn(),
      closeJoinModal: vi.fn(),
      join: mocks.controllerJoin,
      markActive: vi.fn(),
      complete: vi.fn(),
    };
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

  it('freshly preflights explicit start, joins canonical Live Exam exactly once, and never starts an ordinary attempt', async () => {
    renderPlayer();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU SCHOOL EXAM' }));

    await waitFor(() => expect(mocks.preflightSchoolExam).toHaveBeenCalledWith(portal.campaignId));
    expect(mocks.preflightSchoolExam).toHaveBeenCalledTimes(1);
    expect(mocks.joinLiveExam).toHaveBeenCalledTimes(1);
    expect(mocks.joinLiveExam).toHaveBeenCalledWith(readyPreflight.accessCode);
    expect(mocks.controllerJoin).toHaveBeenCalledWith(joinedSession);
    expect(mocks.startRoundAttempt).not.toHaveBeenCalled();
  });

  it('surfaces a canonical join rejection and does not enter the player', async () => {
    mocks.joinLiveExam.mockRejectedValue(new Error('SCHOOL_EXAM_WINDOW_CLOSED'));
    renderPlayer();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU SCHOOL EXAM' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('SCHOOL_EXAM_WINDOW_CLOSED');
    expect(mocks.controllerJoin).not.toHaveBeenCalled();
    expect(screen.queryByText(/canonical-live-exam/)).not.toBeInTheDocument();
  });

  it.each(['waiting', 'active', 'paused'])('reuses the canonical Live Exam screen for %s', (stage) => {
    mocks.controller = { ...mocks.controller, joinedExam: { sessionId: 'live-school-1' }, stage };
    renderPlayer();

    expect(screen.getByText(`canonical-live-exam-${stage}`)).toBeInTheDocument();
  });

  it.each(['submitted', 'results'])('embargoes %s without rendering temporary score, rank, or ResultsRoom', (stage) => {
    mocks.controller = {
      ...mocks.controller,
      joinedExam: { sessionId: 'live-school-1' },
      stage,
      submission: { score: 9.5, correctCount: 19, wrongCount: 1, submittedAt: '2026-10-10T09:00:00.000Z' },
    };
    renderPlayer();

    expect(screen.getByText(EMBARGO_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/9\.5|xếp hạng|canonical-live-exam/i)).not.toBeInTheDocument();
  });

  it('keeps a teacher/admin session outside the Student guard so join is unreachable', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isLoggedIn: true,
      username: 'admin.one',
      teacherName: 'Quản trị viên',
      isAdmin: true,
    });

    render(
      <MemoryRouter initialEntries={['/thi/olympic-toan/school-exam/lam-bai']}>
        <Routes>
          <Route
            path="/thi/:campaignSlug/school-exam/lam-bai"
            element={(
              <ProtectedRoute role="student" sessionsReady>
                <Outlet context={portal} />
              </ProtectedRoute>
            )}
          >
            <Route index element={<CompetitionSchoolExamPlayer />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/?login=student'));
    expect(mocks.preflightSchoolExam).not.toHaveBeenCalled();
    expect(mocks.joinLiveExam).not.toHaveBeenCalled();
  });
});
