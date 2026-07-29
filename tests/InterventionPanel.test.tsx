import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterventionPanel } from '../src/components/teacher/ResultsView/InterventionPanel';
import type { InterventionDashboard } from '../shared/intervention.contract';

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  createGroup: vi.fn(),
  addNote: vi.fn(),
  createAssignments: vi.fn(),
}));

vi.mock('../src/services/results/interventionService', () => ({
  getInterventionDashboard: mocks.getDashboard,
  createInterventionGroup: mocks.createGroup,
  addInterventionNote: mocks.addNote,
  createInterventionAssignments: mocks.createAssignments,
}));

const student = {
  studentId: 'student-1',
  studentName: 'Lan',
  classId: 'class-1',
  className: '4A',
  latestResultId: 'result-3',
  latestSubmittedAt: '2026-07-28T08:00:00.000Z',
  firstAttemptScore: 4,
  latestAttemptScore: 6,
  scoreDelta: 2,
  attemptCount: 3,
  skillAccuracy: 33,
  skillSampleSize: 3,
  confidence: 0.6,
  fourWeekTrend: [],
};

const dashboard: InterventionDashboard = {
  generatedAt: '2026-07-29T08:00:00.000Z',
  criteria: { windowDays: 28, minimumSampleSize: 3, minimumConfidence: 0.55 },
  suggestions: [{
    key: 'class-1:math:phan_so',
    title: 'Cần hỗ trợ ở Phân số',
    classId: 'class-1',
    className: '4A',
    subject: 'math',
    subjectLabel: 'Toán',
    skillCode: 'phan_so',
    skillLabel: 'Phân số',
    sampleSize: 3,
    confidence: 0.6,
    studentCount: 1,
    averageFirstScore: 4,
    averageLatestScore: 6,
    averageScoreDelta: 2,
    students: [student],
    recommendedQuizzes: [{
      quizId: 'quiz-recommended',
      title: 'Luyện tập phân số',
      questionCount: 10,
      matchedQuestionCount: 8,
      confidence: 0.8,
    }],
  }],
  groups: [{
    id: 'group-1',
    name: 'Cần hỗ trợ ở Phân số',
    status: 'ACTIVE',
    classId: 'class-1',
    className: '4A',
    subject: 'math',
    subjectLabel: 'Toán',
    skillCode: 'phan_so',
    skillLabel: 'Phân số',
    sampleSize: 3,
    confidence: 0.6,
    recommendedQuizzes: [{
      quizId: 'quiz-recommended',
      title: 'Luyện tập phân số',
      questionCount: 10,
      matchedQuestionCount: 8,
      confidence: 0.8,
    }],
    members: [student],
    notes: [],
    createdAt: '2026-07-29T08:00:00.000Z',
    updatedAt: '2026-07-29T08:00:00.000Z',
  }],
};

const quizzes = [
  { id: 'quiz-other', title: 'Bài khác', questions: [], timeLimit: 10 },
  { id: 'quiz-recommended', title: 'Luyện tập phân số', questions: [], timeLimit: 15 },
] as any;

describe('InterventionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDashboard.mockResolvedValue(dashboard);
    mocks.createGroup.mockResolvedValue(dashboard.groups[0]);
    mocks.addNote.mockResolvedValue({
      id: 'note-1', groupId: 'group-1', studentId: null,
      note: 'Ghi chú riêng', createdAt: '2026-07-29T09:00:00.000Z', updatedAt: '2026-07-29T09:00:00.000Z',
    });
    mocks.createAssignments.mockResolvedValue({
      groupId: 'group-1', assignmentIds: ['a-1'], skippedAssignmentIds: [], replayed: false,
    });
  });

  it('uses supportive language and creates a persisted group from an eligible suggestion', async () => {
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect((await screen.findAllByText('Cần hỗ trợ ở Phân số'))[0]).toBeVisible();
    expect(screen.queryByText(/học sinh yếu/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nhóm hỗ trợ' }));

    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      suggestionKey: 'class-1:math:phan_so',
      className: '4A',
      studentIds: ['student-1'],
    })));
  });

  it('keeps notes explicitly private and reaches assignment confirmation in two actions', async () => {
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findAllByText('Cần hỗ trợ ở Phân số');

    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết' }));
    expect(screen.getByText('Ghi chú riêng — chỉ giáo viên nhìn thấy')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText(/Ghi lại hoàn cảnh/), {
      target: { value: 'Cần thêm đồ dùng trực quan.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    await waitFor(() => expect(mocks.addNote).toHaveBeenCalledWith('group-1', {
      note: 'Cần thêm đồ dùng trực quan.',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài luyện' }));
    const quizSelect = screen.getByLabelText('Bài kiểm tra') as HTMLSelectElement;
    expect(quizSelect.value).toBe('quiz-recommended');
    fireEvent.click(screen.getByRole('button', { name: 'Giao bài cho nhóm' }));

    await waitFor(() => expect(mocks.createAssignments).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        quizId: 'quiz-recommended',
        maxAttempts: 1,
        idempotencyKey: expect.stringContaining('intervention-group-1-'),
      }),
    ));
  });
});
