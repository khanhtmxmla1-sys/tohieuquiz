// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClassAttendance: vi.fn(),
  setClassAttendanceEnabled: vi.fn(),
  createClassAttendanceQuestion: vi.fn(),
  updateClassAttendanceQuestion: vi.fn(),
  deleteClassAttendanceQuestion: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock('../src/services/attendanceService', () => ({
  getClassAttendance: mocks.getClassAttendance,
  setClassAttendanceEnabled: mocks.setClassAttendanceEnabled,
  createClassAttendanceQuestion: mocks.createClassAttendanceQuestion,
  updateClassAttendanceQuestion: mocks.updateClassAttendanceQuestion,
  deleteClassAttendanceQuestion: mocks.deleteClassAttendanceQuestion,
}));

vi.mock('../src/utils/toast', () => ({
  showInfo: mocks.showInfo,
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
  showConfirm: mocks.showConfirm,
}));

vi.mock('../src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor', () => ({
  default: () => <div data-testid="rich-question-editor" />,
}));

vi.mock('../src/features/manual-quiz-workspace/components/CompactMediaAttachment', () => ({
  default: () => <div data-testid="media-attachment" />,
}));

vi.mock('../src/features/manual-quiz-workspace/math-composer/MathComposerPanel', () => ({
  default: () => null,
}));

import AttendanceQuestionBankPanel from '../src/features/class-management/components/AttendanceQuestionBankPanel';

const questions = [
  { id: 'q1', subject: 'Toán', question: '1 + 1?', options: ['1', '2', '3', '4'], correctAnswer: 'B', image: '', imageAlt: '', createdAt: '', updatedAt: '' },
  { id: 'q2', subject: 'Tiếng Việt', question: 'Từ nào chỉ hoạt động?', options: ['chạy', 'đẹp', 'xanh', 'bàn'], correctAnswer: 'A', image: '', imageAlt: '', createdAt: '', updatedAt: '' },
  { id: 'q3', subject: 'Toán', question: '2 + 2?', options: ['1', '2', '3', '4'], correctAnswer: 'D', image: '', imageAlt: '', createdAt: '', updatedAt: '' },
];

const summary = {
  enabled: false,
  questions,
  stats: { claimedToday: 28, totalStudents: 32 },
};

describe('AttendanceQuestionBankPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getClassAttendance.mockResolvedValue(summary);
    mocks.setClassAttendanceEnabled.mockResolvedValue({ ...summary, enabled: true });
    mocks.showConfirm.mockResolvedValue(true);
  });

  it('keeps the class view compact and shows attendance stats only through a small button', async () => {
    render(<AttendanceQuestionBankPanel classId="class-a" teacherUsername="teacher-a" isOnline />);

    expect(await screen.findByText('3 câu · Mỗi học sinh nhận ngẫu nhiên 2 câu')).toBeVisible();
    const stats = screen.getByRole('button', { name: 'Xem thống kê điểm danh hôm nay' });
    expect(stats).toHaveTextContent('28/32');

    fireEvent.click(stats);
    expect(mocks.showInfo).toHaveBeenCalledWith('Hôm nay đã có 28/32 học sinh điểm danh.');
  });

  it('uses one simple on/off action and opens the question manager on demand', async () => {
    render(<AttendanceQuestionBankPanel classId="class-a" teacherUsername="teacher-a" isOnline />);

    await screen.findByText('3 câu · Mỗi học sinh nhận ngẫu nhiên 2 câu');
    fireEvent.click(screen.getByRole('button', { name: 'Bật' }));

    await waitFor(() => expect(mocks.setClassAttendanceEnabled).toHaveBeenCalledWith('class-a', true));
    expect(await screen.findByText('Đang bật')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi' }));
    expect(screen.getByRole('dialog', { name: 'Quản lý câu hỏi điểm danh' })).toBeVisible();
    expect(screen.getByText('Có 3 câu. Học sinh được lấy ngẫu nhiên 2 câu mỗi ngày.')).toBeVisible();
  });
});
