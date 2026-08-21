import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompetitionDashboardPage from '../src/features/competition/CompetitionDashboardPage';
import { useAuthStore } from '../stores/authStore';

const api = vi.hoisted(() => ({ callApi: vi.fn() }));

vi.mock('../src/services/apiAdapter', () => ({ callApi: api.callApi }));

const workflowHeadings = [
  'Chiến dịch & đối tượng',
  '6 vòng thi',
  'Điều kiện dự thi',
  'Thi cấp trường',
  'Đối soát',
  'Công bố & xếp hạng',
  'Chứng nhận & XLSX',
];

const adminMutationLabels = [
  'Xem trước đối tượng',
  'Đóng băng đối tượng',
  'Chốt điều kiện dự thi',
  'Chạy preflight',
  'Bắt đầu đối soát',
];

describe('Competition V1 admin and teacher dashboard surface', () => {
  beforeEach(() => {
    api.callApi.mockReset();
    api.callApi.mockResolvedValue({ items: [] });
    useAuthStore.setState({ teacherClasses: [], teacherClass: null });
  });
  it('shows the approved end-to-end workflow and admin mutation controls to Admin', () => {
    render(<CompetitionDashboardPage isAdmin username="admin" />);

    for (const heading of workflowHeadings) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    for (const label of adminMutationLabels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Xuất XLSX toàn trường' })).toBeInTheDocument();
  });

  it('keeps Teacher configuration read-only and exposes only class-scoped export', () => {
    render(<CompetitionDashboardPage isAdmin={false} username="teacher-a" />);

    expect(screen.getByText('Chỉ đọc theo phạm vi lớp')).toBeInTheDocument();
    for (const label of adminMutationLabels) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Xuất XLSX toàn trường' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất XLSX theo lớp' })).toBeInTheDocument();
  });

  it('shows class-scoped Teacher attempts, best score and eligibility progress from the server', async () => {
    useAuthStore.setState({ teacherClasses: [{ id: 'class-4a', name: '4A' }] });
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return {
        items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'ACTIVE', audienceSnapshotId: 'audience-1' }],
      };
      if (action === 'get_competition_rounds') return { items: [{ id: 'round-1', roundNumber: 1, status: 'OPEN', maxAttempts: 3, passingScore: 7 }] };
      if (action === 'get_competition_eligibility') return {
        campaignId: 'campaign-1', version: 1,
        items: [{ id: 'elig-1', campaignId: 'campaign-1', version: 1, studentId: 'student-1', qualified: true, reasonCodes: ['QUALIFIED'] }],
      };
      if (action === 'list_school_exam_events') return { items: [] };
      if (action === 'get_competition_progress') return {
        items: [{ campaignId: 'campaign-1', roundId: 'round-1', roundNumber: 1, studentId: 'student-1', classId: 'class-4a', attemptsUsed: 2, bestScore: 8.5, isPassed: true, status: 'PASSED' }],
      };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin={false} username="teacher-4" />);
    expect(await screen.findByRole('heading', { name: 'Tiến độ lớp' })).toBeInTheDocument();
    expect(await screen.findByText(/student-1 · Vòng 1/)).toBeInTheDocument();
    expect(api.callApi).toHaveBeenCalledWith('get_competition_progress', { campaignId: 'campaign-1' });
    expect(screen.getByText(/2 lượt/)).toBeInTheDocument();
    expect(screen.getByText(/Điểm tốt nhất 8.5/)).toBeInTheDocument();
    expect(screen.getByText(/Đã đạt/)).toBeInTheDocument();
  });

  it('creates and edits a DRAFT campaign with audience and eligibility policy through Admin APIs', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return { items: [] };
      if (action === 'create_competition') return {
        campaign: {
          id: 'campaign-new', title: payload.title, schoolYear: payload.schoolYear, timezone: payload.timezone,
          status: 'DRAFT', audienceRule: payload.audienceRule, eligibilityPolicy: payload.eligibilityPolicy,
          audienceSnapshotId: null, startsAt: payload.startsAt, endsAt: payload.endsAt,
        },
      };
      if (action === 'update_competition') return {
        campaign: {
          id: 'campaign-new', title: payload.title, schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh',
          status: 'DRAFT', audienceRule: { gradeLevels: [4], classIds: ['class-4a'] },
          eligibilityPolicy: { requiredRounds: 6, requiredPassedRounds: 6 }, audienceSnapshotId: null,
          startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2027-05-31T23:59:59.000Z',
        },
      };
      if (action === 'get_competition_rounds' || action === 'list_school_exam_events') return { items: [] };
      if (action === 'get_competition_eligibility') throw new Error('not finalized');
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByText('Chưa có chiến dịch');

    fireEvent.change(screen.getByLabelText('Tên chiến dịch'), { target: { value: 'Hội thi 2026' } });
    fireEvent.change(screen.getByLabelText('Năm học'), { target: { value: '2026-2027' } });
    fireEvent.change(screen.getByLabelText('Khối tham gia'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Lớp tham gia'), { target: { value: 'class-4a' } });
    fireEvent.change(screen.getByLabelText('Bắt đầu chiến dịch'), { target: { value: '2026-09-01T07:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc chiến dịch'), { target: { value: '2027-05-31T23:59' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('create_competition', expect.objectContaining({
      title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh',
      audienceRule: { gradeLevels: [4], classIds: ['class-4a'] },
      eligibilityPolicy: { requiredRounds: 6, requiredPassedRounds: 6 },
      requestId: expect.any(String),
    })));
    expect(await screen.findByRole('option', { name: 'Hội thi 2026' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tên chiến dịch'), { target: { value: 'Hội thi 2026 cập nhật' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu chiến dịch' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('update_competition', expect.objectContaining({
      campaignId: 'campaign-new', title: 'Hội thi 2026 cập nhật', requestId: expect.any(String),
    })));
  });

  it('runs Audience Preview and explicit Freeze as Admin server mutations', async () => {
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return {
        items: [{
          id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh',
          status: 'DRAFT', audienceSnapshotId: null,
        }],
      };
      if (action === 'get_competition_rounds' || action === 'list_school_exam_events') return { items: [] };
      if (action === 'get_competition_eligibility') throw new Error('not finalized');
      if (action === 'preview_competition_audience') return {
        preview: { matchedCount: 2, countsByGrade: { '4': 2 }, countsByClass: { 'class-4a': 2 } },
      };
      if (action === 'freeze_competition_audience') return {
        snapshot: { id: 'audience-1', memberCount: 2, status: 'LOCKED' },
      };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByRole('option', { name: 'Hội thi 2026' });

    fireEvent.click(screen.getByRole('button', { name: 'Xem trước đối tượng' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('preview_competition_audience', { campaignId: 'campaign-1' }));
    expect(await screen.findByText('2 học sinh phù hợp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng băng đối tượng' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'freeze_competition_audience',
      expect.objectContaining({ campaignId: 'campaign-1', requestId: expect.any(String) }),
    ));
    expect(await screen.findByText('Audience: Đã đóng băng')).toBeInTheDocument();
  });

  it('renders six Admin round editor slots and persists/finalizes a configured round through server actions', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return {
        items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'ACTIVE', audienceSnapshotId: 'audience-1' }],
      };
      if (action === 'get_competition_rounds') return {
        items: [
          {
            id: 'round-1', campaignId: 'campaign-1', roundNumber: 1,
            opensAt: '2026-09-01T01:00:00.000Z', closesAt: '2026-09-01T02:00:00.000Z',
            maxAttempts: 2, passingScore: 8, status: 'SCHEDULED',
          },
          {
            id: 'round-2', campaignId: 'campaign-1', roundNumber: 2,
            opensAt: '2026-08-01T01:00:00.000Z', closesAt: '2026-08-01T02:00:00.000Z',
            maxAttempts: 2, passingScore: 8, status: 'CLOSED',
          },
        ],
      };
      if (action === 'get_competition_eligibility') throw new Error('not finalized');
      if (action === 'list_school_exam_events') return { items: [] };
      if (action === 'update_competition_round') return { round: { ...payload, status: 'SCHEDULED' } };
      if (action === 'finalize_competition_round') return { round: { id: payload.roundId, campaignId: payload.campaignId, roundNumber: 2, status: 'FINALIZED' } };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByRole('option', { name: 'Hội thi 2026' });

    for (let roundNumber = 1; roundNumber <= 6; roundNumber += 1) {
      expect(await screen.findByRole('heading', { name: `Vòng ${roundNumber}` })).toBeInTheDocument();
    }

    fireEvent.change(screen.getByLabelText('Số lượt tối đa vòng 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Điểm đạt vòng 1'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vòng 1' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'update_competition_round',
      expect.objectContaining({
        campaignId: 'campaign-1', roundId: 'round-1', roundNumber: 1,
        maxAttempts: 3, passingRuleType: 'MIN_SCORE', passingScore: 9,
        requestId: expect.any(String),
      }),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Chốt vòng 2' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'finalize_competition_round',
      expect.objectContaining({ campaignId: 'campaign-1', roundId: 'round-2', requestId: expect.any(String) }),
    ));
  });

  it('lets Admin map a round quiz by grade and shows the locked mapping read-only to Teacher', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return {
        items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'ACTIVE', audienceSnapshotId: 'audience-1' }],
      };
      if (action === 'get_competition_rounds') return {
        items: [{
          id: 'round-1', campaignId: 'campaign-1', roundNumber: 1,
          opensAt: '2026-09-01T01:00:00.000Z', closesAt: '2026-09-01T02:00:00.000Z',
          maxAttempts: 2, passingScore: 8, status: 'SCHEDULED',
          quizSnapshot: { status: 'LOCKED', mappingCount: 1 },
          quizMappings: [{ gradeLevel: 4, classId: null, quizId: 'quiz-round', quizSnapshotId: 'snapshot-1', quizSnapshotHash: 'a'.repeat(64) }],
        }],
      };
      if (action === 'upsert_competition_round_quiz') return {
        mapping: { ...payload, classId: null, quizSnapshotId: 'snapshot-1', quizSnapshotHash: 'a'.repeat(64) },
      };
      if (action === 'get_competition_eligibility') throw new Error('not finalized');
      return { items: [] };
    });

    const { unmount } = render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByRole('option', { name: 'Hội thi 2026' });
    fireEvent.change(screen.getByLabelText('Khối quiz vòng 1'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Quiz ID vòng 1'), { target: { value: 'quiz-round' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gán quiz vòng 1' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'upsert_competition_round_quiz',
      expect.objectContaining({
        campaignId: 'campaign-1', roundId: 'round-1', gradeLevel: 4, quizId: 'quiz-round', requestId: expect.any(String),
      }),
    ));
    unmount();

    render(<CompetitionDashboardPage isAdmin={false} username="teacher-4" />);
    expect(await screen.findByText(/Khối 4 · mặc định · quiz-round/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gán quiz vòng 1' })).not.toBeInTheDocument();
  });

  it('creates a School Exam event and room plan through Admin server mutations', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return {
        items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'ELIGIBILITY_LOCKED', audienceSnapshotId: 'audience-1' }],
      };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 3, items: [] };
      if (action === 'list_school_exam_events') return { items: [] };
      if (action === 'create_school_exam_event') return {
        event: {
          id: 'event-1', campaignId: 'campaign-1', title: payload.title, status: 'DRAFT', examDate: payload.examDate,
          eligibilitySnapshotVersion: 3, rankingPolicy: 'SCORE_CORRECT_TIME', examFormPolicy: 'SAME_FORM', rooms: [],
        },
      };
      if (action === 'create_school_exam_room') return {
        room: { id: 'room-1', name: payload.name, roomCode: payload.roomCode, formCode: payload.formCode, memberCount: payload.studentIds.length, provisionStatus: 'PENDING' },
        warnings: [],
      };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByRole('option', { name: 'Hội thi 2026' });
    await screen.findByText('Snapshot version 3');

    fireEvent.change(screen.getByLabelText('Tên kỳ thi cấp trường'), { target: { value: 'Thi cấp trường 2027' } });
    fireEvent.change(screen.getByLabelText('Ngày thi cấp trường'), { target: { value: '2027-05-10T08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo kỳ thi cấp trường' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'create_school_exam_event',
      expect.objectContaining({
        campaignId: 'campaign-1', eligibilitySnapshotVersion: 3, title: 'Thi cấp trường 2027',
        rankingPolicy: 'SCORE_CORRECT_TIME', examFormPolicy: 'SAME_FORM', requestId: expect.any(String),
      }),
    ));

    fireEvent.change(screen.getByLabelText('Tên phòng/ca'), { target: { value: 'Phòng A' } });
    fireEvent.change(screen.getByLabelText('Mã phòng'), { target: { value: 'A1' } });
    fireEvent.change(screen.getByLabelText('Lịch thi phòng'), { target: { value: '2027-05-10T08:00' } });
    fireEvent.change(screen.getByLabelText('Quiz ID'), { target: { value: 'quiz-1' } });
    fireEvent.change(screen.getByLabelText('Giám thị'), { target: { value: 'teacher-a' } });
    fireEvent.change(screen.getByLabelText('Học sinh'), { target: { value: 'student-1, student-2' } });
    fireEvent.change(screen.getByLabelText('Blueprint ID'), { target: { value: 'tv4-v1' } });
    fireEvent.change(screen.getByLabelText('Mục tiêu'), { target: { value: 'obj-1, obj-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng/ca thi' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'create_school_exam_room',
      expect.objectContaining({
        eventId: 'event-1', name: 'Phòng A', roomCode: 'A1', quizId: 'quiz-1',
        invigilatorIds: ['teacher-a'], studentIds: ['student-1', 'student-2'],
        formDefinition: expect.objectContaining({ blueprintId: 'tv4-v1', objectiveIds: ['obj-1', 'obj-2'] }),
        requestId: expect.any(String),
      }),
    ));
    expect(await screen.findByText('Phòng A')).toBeInTheDocument();
  });

  it('separates reconcile state and enforces WITHHELD → READY_TO_PUBLISH → PUBLISHED before ranking', async () => {
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return {
        items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'WITHHELD', audienceSnapshotId: 'audience-1' }],
      };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return {
        items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'WITHHELD', examDate: '2027-05-10T01:00:00.000Z', rooms: [] }],
      };
      if (action === 'get_school_exam_reconcile') return {
        reconcile: {
          id: 'reconcile-1', version: 1, status: 'BLOCKED', blockingIssues: 1, canonicalResults: 10,
          allRoomsClosed: true, eventStatus: 'WITHHELD',
          issues: [
            { id: 'issue-1', issueType: 'MISSING_SUBMISSION', blocking: true },
            { id: 'issue-2', issueType: 'LATE_SUBMISSION_WARNING', blocking: false },
          ],
        },
      };
      if (action === 'list_school_exam_incidents') return { items: [{ id: 'incident-1', reasonCode: 'NETWORK_FAILURE', studentId: 'student-1', roomId: 'room-1' }] };
      if (action === 'list_school_exam_retests') return { items: [{ id: 'retest-1', studentId: 'student-1', status: 'REQUESTED', reasonCode: 'NETWORK_FAILURE' }] };
      if (action === 'start_school_exam_reconcile') return {
        reconcile: { id: 'reconcile-2', version: 2, status: 'READY', blockingIssues: 0, canonicalResults: 10, allRoomsClosed: true, eventStatus: 'READY_TO_PUBLISH', issues: [] },
      };
      if (action === 'publish_school_exam_results') return {
        publication: { id: 'pub-1', eventId: 'event-1', publicationVersion: 1, rankingVersion: 1, status: 'PUBLISHED' },
      };
      if (action === 'get_school_exam_rankings') return {
        rankings: {
          eventId: 'event-1', publicationVersion: 1, rankingVersion: 1, scope: 'EVENT',
          items: [{ studentId: 'student-1', originalClassId: 'class-4a', gradeLevel: 4, score: 10, correctCount: 10, timeTaken: 120, rank: 1 }],
        },
      };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByText('MISSING_SUBMISSION');
    expect(screen.getByText('Blockers (1)')).toBeInTheDocument();
    expect(screen.getByText('Warnings (1)')).toBeInTheDocument();
    expect(screen.getByText('Sự cố (1)')).toBeInTheDocument();
    expect(screen.getByText('Thi lại (1)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Công bố kết quả' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu đối soát' }));
    await screen.findByRole('button', { name: 'Công bố kết quả' });
    fireEvent.click(screen.getByRole('button', { name: 'Công bố kết quả' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith(
      'publish_school_exam_results',
      expect.objectContaining({ eventId: 'event-1', requestId: expect.any(String) }),
    ));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('get_school_exam_rankings', { eventId: 'event-1', scope: 'EVENT' }));
    expect(await screen.findByText('student-1')).toBeInTheDocument();
    expect(screen.getByText('Hạng 1')).toBeInTheDocument();
  });

  it('runs capacity preflight before provisioning school-exam rooms', async () => {
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'EXAM_PREP', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'DRAFT', examDate: '2027-05-10T01:00:00.000Z', examFormPolicy: 'SAME_FORM', rooms: [{ id: 'room-1', name: 'Phòng A', formCode: 'A', memberCount: 80, provisionStatus: 'PENDING' }] }] };
      if (action === 'run_school_exam_preflight') return { preflight: { status: 'READY', plannedConcurrency: 80, certifiedConcurrentStudents: 100, capacityProfileId: 'capacity-100' } };
      if (action === 'provision_school_exam') return { provision: { status: 'READY', provisioned: 1, failed: 0 } };
      if (action === 'get_school_exam_event') return { event: { id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'SCHEDULED', examDate: '2027-05-10T01:00:00.000Z', rooms: [{ id: 'room-1', name: 'Phòng A', formCode: 'A', memberCount: 80, provisionStatus: 'READY' }] } };
      if (action === 'list_school_exam_incidents' || action === 'list_school_exam_retests') return { items: [] };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByText('Phòng A');
    const preflightButton = screen.getByRole('button', { name: 'Chạy preflight' });
    fireEvent.click(preflightButton);
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('run_school_exam_preflight', expect.objectContaining({ eventId: 'event-1', requestId: expect.any(String) })));
    expect(await screen.findByText('80 / 100')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Provision phòng thi' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('provision_school_exam', expect.objectContaining({ eventId: 'event-1', requestId: expect.any(String) })));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('get_school_exam_event', { eventId: 'event-1' }));
  });

  it('lets Teacher report incidents only through assigned-room Competition controls', async () => {
    useAuthStore.setState({ teacherClasses: [{ id: 'class-4a', name: '4A' }] });
    let incidentReads = 0;
    let retestReads = 0;
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'EXAM_PREP', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds' || action === 'get_competition_progress') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'WITHHELD', examDate: '2027-05-10T01:00:00.000Z', rooms: [{ id: 'room-1', name: 'Phòng A', formCode: 'A', memberCount: 20, provisionStatus: 'READY' }] }] };
      if (action === 'list_school_exam_incidents') {
        incidentReads += 1;
        return { items: incidentReads > 1 ? [{ id: 'incident-1', eventId: 'event-1', roomId: 'room-1', studentId: 'student-1', reasonCode: 'NETWORK_FAILURE' }] : [] };
      }
      if (action === 'list_school_exam_retests') {
        retestReads += 1;
        return { items: retestReads > 1 ? [{ id: 'retest-1', eventId: 'event-1', studentId: 'student-1', status: 'REQUESTED', reasonCode: 'NETWORK_FAILURE' }] : [] };
      }
      if (action === 'report_school_exam_incident') return { incident: { id: 'incident-1' }, retest: { id: 'retest-1' } };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin={false} username="teacher-4" />);
    await screen.findByRole('heading', { name: 'Báo cáo sự cố phòng được phân công' });
    fireEvent.change(screen.getByLabelText('Phòng sự cố'), { target: { value: 'room-1' } });
    fireEvent.change(screen.getByLabelText('Học sinh sự cố'), { target: { value: 'student-1' } });
    fireEvent.change(screen.getByLabelText('Kết quả gốc'), { target: { value: 'result-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo sự cố' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('report_school_exam_incident', expect.objectContaining({
      eventId: 'event-1', roomId: 'room-1', studentId: 'student-1', originalResultId: 'result-1', reasonCode: 'NETWORK_FAILURE', requestId: expect.any(String),
    })));
    expect(await screen.findByText('Sự cố (1)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cấp thi lại/ })).not.toBeInTheDocument();
  });

  it('lets Admin grant a requested retest with an explicit resolution', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'WITHHELD', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'WITHHELD', examDate: '2027-05-10T01:00:00.000Z', rooms: [] }] };
      if (action === 'list_school_exam_incidents') return { items: [] };
      if (action === 'list_school_exam_retests') return { items: [{ id: 'retest-1', eventId: 'event-1', studentId: 'student-1', status: 'REQUESTED', reasonCode: 'NETWORK_FAILURE' }] };
      if (action === 'grant_school_exam_retest') return { retest: { id: 'retest-1', eventId: 'event-1', studentId: 'student-1', status: 'APPROVED', resolution: payload.resolution } };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    const resolution = await screen.findByLabelText('Cách xử lý thi lại student-1');
    fireEvent.change(resolution, { target: { value: 'KEEP_ORIGINAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cấp thi lại student-1' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('grant_school_exam_retest', expect.objectContaining({
      eventId: 'event-1', retestId: 'retest-1', resolution: 'KEEP_ORIGINAL', expiresAt: expect.any(String), requestId: expect.any(String),
    })));
    expect(await screen.findByText('Đã cấp thi lại.')).toBeInTheDocument();
  });

  it('queues, polls and exposes a download link only when XLSX is READY', async () => {
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'PUBLISHED', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'PUBLISHED', examDate: '2027-05-10T01:00:00.000Z', rooms: [] }] };
      if (action === 'get_school_exam_rankings') return { rankings: { eventId: 'event-1', publicationVersion: 1, rankingVersion: 1, scope: 'EVENT', items: [] } };
      if (action === 'list_school_exam_incidents' || action === 'list_school_exam_retests') return { items: [] };
      if (action === 'create_school_exam_export') return { export: { id: 'export-1', eventId: 'event-1', publicationVersion: 1, scope: 'SCHOOL', status: 'QUEUED' } };
      if (action === 'get_school_exam_export') return { export: { id: 'export-1', eventId: 'event-1', publicationVersion: 1, scope: 'SCHOOL', status: 'READY' } };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByText('Event: PUBLISHED');
    const exportButton = screen.getByRole('button', { name: 'Xuất XLSX toàn trường' });
    fireEvent.click(exportButton);
    await screen.findByText(/Export export-1: QUEUED/);
    expect(screen.queryByRole('link', { name: 'Tải XLSX' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới XLSX' }));
    const download = await screen.findByRole('link', { name: 'Tải XLSX' });
    expect(download).toHaveAttribute('href', '/api/school-exams/event-1/exports/export-1/download');
  });

  it('creates Competition certificate batches from an immutable published ranking snapshot', async () => {
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'PUBLISHED', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'PUBLISHED', examDate: '2027-05-10T01:00:00.000Z', rooms: [] }] };
      if (action === 'get_school_exam_rankings') return { rankings: { eventId: 'event-1', publicationVersion: 2, rankingVersion: 2, scope: 'EVENT', items: [{ studentId: 'student-1', originalClassId: 'class-4a', gradeLevel: 4, score: 10, correctCount: 10, timeTaken: 100, rank: 1 }] } };
      if (action === 'list_school_exam_incidents' || action === 'list_school_exam_retests') return { items: [] };
      if (action === 'create_competition_certificate_batch') return { certificateBatch: { id: 'cert-parent-1', eventId: 'event-1', publicationVersion: 2, rankingVersion: 2, status: 'QUEUED', winnerCount: payload.winnerStudentIds.length, batchCount: 1, batches: [] } };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);
    await screen.findByText('Publication v2 · Ranking v2 · EVENT');
    fireEvent.change(screen.getByLabelText('Mẫu chứng nhận Competition'), { target: { value: 'template-competition' } });
    fireEvent.change(screen.getByLabelText('Học sinh nhận chứng nhận'), { target: { value: 'student-1' } });
    fireEvent.change(screen.getByLabelText('Tiêu đề chứng nhận Competition'), { target: { value: 'Competition Winners' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo chứng nhận người đạt giải' }));

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('create_competition_certificate_batch', expect.objectContaining({
      eventId: 'event-1', publicationVersion: 2, rankingVersion: 2, winnerStudentIds: ['student-1'],
      templateId: 'template-competition', title: 'Competition Winners', requestId: expect.any(String),
    })));
    expect(await screen.findByText(/Certificate batch cert-parent-1: QUEUED/)).toBeInTheDocument();
  });

  it('uses CLASS ranking and class-scoped XLSX for Teacher after publication', async () => {
    useAuthStore.setState({ teacherClasses: [{ id: 'class-4a', name: '4A' }] });
    api.callApi.mockImplementation(async (action: string, payload?: any) => {
      if (action === 'list_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'PUBLISHED', audienceSnapshotId: 'audience-1' }] };
      if (action === 'get_competition_rounds' || action === 'get_competition_progress') return { items: [] };
      if (action === 'get_competition_eligibility') return { campaignId: 'campaign-1', version: 1, items: [] };
      if (action === 'list_school_exam_events') return { items: [{ id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'PUBLISHED', examDate: '2027-05-10T01:00:00.000Z', rooms: [] }] };
      if (action === 'get_school_exam_rankings') return { rankings: { eventId: 'event-1', publicationVersion: 1, rankingVersion: 1, scope: 'CLASS', items: [{ studentId: 'student-1', originalClassId: 'class-4a', gradeLevel: 4, score: 9, correctCount: 9, timeTaken: 120, rank: 1 }] } };
      if (action === 'list_school_exam_incidents' || action === 'list_school_exam_retests') return { items: [] };
      if (action === 'create_school_exam_export') return { export: { id: 'export-class-1', eventId: 'event-1', publicationVersion: 1, scope: 'CLASS', classId: payload.classId, status: 'QUEUED' } };
      return {};
    });

    render(<CompetitionDashboardPage isAdmin={false} username="teacher-4" />);
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('get_school_exam_rankings', { eventId: 'event-1', scope: 'CLASS', classId: 'class-4a' }));
    expect(await screen.findByText('Hạng 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xuất XLSX theo lớp' }));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('create_school_exam_export', expect.objectContaining({
      eventId: 'event-1', scope: 'CLASS', classId: 'class-4a', requestId: expect.any(String),
    })));
  });

  it('loads campaign, rounds, eligibility and school-exam planner data from Competition APIs', async () => {
    api.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_competitions') return {
        items: [{
          id: 'campaign-1', title: 'Hội thi 2026', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh',
          status: 'EXAM_PREP', audienceSnapshotId: 'audience-1',
        }],
      };
      if (action === 'get_competition_rounds') return {
        items: [{
          id: 'round-1', campaignId: 'campaign-1', roundNumber: 1,
          opensAt: '2026-09-01T01:00:00.000Z', closesAt: '2026-09-01T02:00:00.000Z',
          maxAttempts: 2, passingScore: 8, status: 'FINALIZED',
        }],
      };
      if (action === 'get_competition_eligibility') return {
        campaignId: 'campaign-1', version: 1,
        items: [
          { studentId: 'student-1', qualified: true },
          { studentId: 'student-2', qualified: false },
        ],
      };
      if (action === 'list_school_exam_events') return {
        items: [{
          id: 'event-1', campaignId: 'campaign-1', title: 'Thi cấp trường', status: 'READY_TO_PUBLISH',
          examDate: '2027-05-10T01:00:00.000Z',
          preflight: { status: 'READY', plannedConcurrency: 80, certifiedConcurrentStudents: 100 },
          rooms: [{ id: 'room-1', name: 'Phòng A', formCode: 'A', memberCount: 40, provisionStatus: 'READY' }],
        }],
      };
      return { items: [] };
    });

    render(<CompetitionDashboardPage isAdmin username="admin" />);

    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('list_competitions'));
    await waitFor(() => expect(api.callApi).toHaveBeenCalledWith('get_competition_rounds', { campaignId: 'campaign-1' }));
    expect(api.callApi).toHaveBeenCalledWith('get_competition_eligibility', { campaignId: 'campaign-1' });
    expect(api.callApi).toHaveBeenCalledWith('list_school_exam_events', { campaignId: 'campaign-1' });

    expect(await screen.findByRole('option', { name: 'Hội thi 2026' })).toBeInTheDocument();
    expect(screen.getByText('Vòng 1')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 học sinh đạt')).toBeInTheDocument();
    expect(screen.getByText('Phòng A')).toBeInTheDocument();
    expect(screen.getByText('80 / 100')).toBeInTheDocument();
  });
});
