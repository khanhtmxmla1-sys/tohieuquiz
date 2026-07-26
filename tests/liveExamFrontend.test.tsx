import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getResultsMock = vi.hoisted(() => vi.fn());
const createLiveExamMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/liveExamService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/liveExamService')>();
  return {
    ...actual,
    getResults: getResultsMock,
    createLiveExam: createLiveExamMock,
  };
});

import { TeacherLiveExamDashboard } from '../src/components/LiveExam/TeacherLiveExamDashboard';
import { ResultsRoom } from '../src/components/LiveExam/ResultsRoom';
import { LiveExamStatus, type LiveExamSession } from '../src/types/liveExam.types';

const session = (status: LiveExamStatus, overrides: Partial<LiveExamSession> = {}): LiveExamSession => ({
  id: `live-${status}`,
  title: `Phiên ${status}`,
  quizId: 'quiz-1',
  quizTitle: 'Toán lớp 4',
  teacherId: 'teacher-a',
  classId: 'class-a',
  className: '4A',
  duration: 30,
  settings: { randomizeAnswers: false, showLeaderboard: true, allowLateJoin: false },
  status,
  accessCode: 'ABC123',
  participantCount: 10,
  submittedCount: status === LiveExamStatus.CLOSED ? 9 : 0,
  averageScore: status === LiveExamStatus.CLOSED ? 8.5 : undefined,
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
  ...overrides,
});

const baseProps = () => ({
  sessions: [
    session(LiveExamStatus.SCHEDULED),
    session(LiveExamStatus.WAITING),
    session(LiveExamStatus.ACTIVE),
    session(LiveExamStatus.SCORING),
    session(LiveExamStatus.CLOSED),
  ],
  availableQuizzes: [{ id: 'quiz-1', title: 'Toán lớp 4', questionCount: 10 }],
  availableClasses: [{ id: 'class-a', name: '4A' }],
  onCreateSession: vi.fn(),
  onSelectSession: vi.fn(),
  onDeleteSession: vi.fn(async () => undefined),
  onRefresh: vi.fn(),
});

describe('live exam teacher dashboard', () => {
  beforeEach(() => {
    getResultsMock.mockReset();
    createLiveExamMock.mockReset();
  });

  it('shows all lifecycle states and opens a closed session through Xem kết quả', () => {
    const props = baseProps();
    render(<TeacherLiveExamDashboard {...props} />);

    expect(screen.getAllByText('Đã lên lịch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang chờ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang thi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang chấm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã kết thúc').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Xem kết quả/i }));
    expect(props.onSelectSession).toHaveBeenCalledWith(expect.objectContaining({ status: LiveExamStatus.CLOSED }));
  });

  it('only offers archive for safe scheduled or closed states', () => {
    render(<TeacherLiveExamDashboard {...baseProps()} />);
    expect(screen.getAllByRole('button', { name: /Lưu trữ/i })).toHaveLength(2);
  });

  it('requires selecting a class before enabling session creation', () => {
    render(<TeacherLiveExamDashboard {...baseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên thi mới/i }));

    const submit = screen.getByRole('button', { name: /^Tạo phiên thi$/i });
    fireEvent.change(screen.getByLabelText(/Tên phiên thi/i), { target: { value: 'Kiểm tra Toán' } });
    fireEvent.change(screen.getByLabelText(/Đề thi/i), { target: { value: 'quiz-1' } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lớp học/i), { target: { value: 'class-a' } });
    expect(submit).toBeEnabled();
  });
});

describe('live exam private results', () => {
  it('hides the leaderboard when the teacher disabled it', async () => {
    getResultsMock.mockResolvedValue({
      success: true,
      participant: {
        score: 8,
        rank: 2,
        correctCount: 8,
        wrongCount: 2,
        submittedAt: '2026-07-15T00:20:00.000Z',
      },
      rewards: { coins: 8, xp: 80 },
      leaderboardVisible: false,
      leaderboard: [],
    });

    render(<ResultsRoom sessionId="live-1" sessionTitle="Kiểm tra Toán" />);

    await waitFor(() => expect(getResultsMock).toHaveBeenCalledWith('live-1'));
    expect(await screen.findByText(/Giáo viên đã ẩn bảng xếp hạng/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Bảng Xếp Hạng/i })).not.toBeInTheDocument();
  });
});
