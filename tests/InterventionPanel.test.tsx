import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterventionPanel } from '../src/components/teacher/ResultsView/InterventionPanel';
import type { InterventionDashboard, InterventionDataReadiness } from '../shared/intervention.contract';

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

const baseReadiness: InterventionDataReadiness = {
  studentsInScope: 1,
  resultsInWindow: 3,
  quizzesInScope: 1,
  questionsInScope: 10,
  questionsWithSkillMetadata: 10,
  skillMetadataCoveragePercent: 100,
  studentSkillSignals: 1,
  eligibleSignals: 1,
  excludedSignals: {
    stable: 0,
    insufficientSamples: 0,
    lowConfidence: 0,
    missingMetadata: 0,
  },
};

const dashboard: InterventionDashboard = {
  generatedAt: '2026-07-29T08:00:00.000Z',
  criteria: { windowDays: 28, minimumSampleSize: 3, minimumConfidence: 0.55 },
  readiness: baseReadiness,
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

const emptyDashboard = (readiness: InterventionDataReadiness): InterventionDashboard => ({
  ...dashboard,
  readiness,
  suggestions: [],
  groups: [],
});

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

  it('uses the new supportive title, shows scope and keeps a 44px accessible refresh target', async () => {
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByRole('heading', { name: 'Gợi ý hỗ trợ học sinh' })).toBeVisible();
    expect(screen.getByText('Lớp 4A · Tất cả bài kiểm tra · 28 ngày')).toBeVisible();
    const refresh = screen.getByRole('button', { name: 'Làm mới gợi ý hỗ trợ học sinh' });
    expect(refresh).toHaveClass('min-h-11');
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

  it('renders one compact readiness state instead of two large empty sections', async () => {
    mocks.getDashboard.mockResolvedValue(emptyDashboard({
      studentsInScope: 15,
      resultsInWindow: 22,
      quizzesInScope: 3,
      questionsInScope: 100,
      questionsWithSkillMetadata: 48,
      skillMetadataCoveragePercent: 48,
      studentSkillSignals: 9,
      eligibleSignals: 0,
      excludedSignals: {
        stable: 0,
        insufficientSamples: 6,
        lowConfidence: 3,
        missingMetadata: 52,
      },
    }));

    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText(/Đã phân tích 15 học sinh · 22 bài làm · 48% câu có gắn kỹ năng/)).toBeVisible();
    expect(screen.queryByText('Gợi ý mới')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhóm đang theo dõi')).not.toBeInTheDocument();
    expect(screen.getByText('Nhiều câu hỏi chưa có thông tin kỹ năng.')).toBeVisible();
  });

  it.each([
    {
      label: 'no results',
      readiness: {
        ...baseReadiness,
        resultsInWindow: 0,
        quizzesInScope: 0,
        questionsInScope: 0,
        questionsWithSkillMetadata: 0,
        skillMetadataCoveragePercent: 0,
        studentSkillSignals: 0,
        eligibleSignals: 0,
      },
      expected: 'Chưa có bài làm trong 28 ngày gần nhất.',
    },
    {
      label: 'missing metadata',
      readiness: {
        ...baseReadiness,
        eligibleSignals: 0,
        questionsWithSkillMetadata: 8,
        skillMetadataCoveragePercent: 80,
        excludedSignals: { ...baseReadiness.excludedSignals, missingMetadata: 2 },
      },
      expected: 'Nhiều câu hỏi chưa có thông tin kỹ năng.',
    },
    {
      label: 'insufficient samples',
      readiness: {
        ...baseReadiness,
        eligibleSignals: 0,
        excludedSignals: { ...baseReadiness.excludedSignals, insufficientSamples: 4 },
      },
      expected: 'Học sinh cần thêm lượt trả lời cho cùng kỹ năng.',
    },
    {
      label: 'low confidence',
      readiness: {
        ...baseReadiness,
        eligibleSignals: 0,
        excludedSignals: { ...baseReadiness.excludedSignals, lowConfidence: 3 },
      },
      expected: 'Dữ liệu hiện có chưa đủ nhất quán để tạo gợi ý.',
    },
    {
      label: 'no weak signal with good coverage',
      readiness: {
        ...baseReadiness,
        eligibleSignals: 0,
        excludedSignals: { ...baseReadiness.excludedSignals, stable: 5 },
      },
      expected: 'Chưa phát hiện nhóm cần hỗ trợ với tiêu chí hiện tại.',
    },
  ])('uses deterministic readiness primary reason: $label', async ({ readiness, expected }) => {
    mocks.getDashboard.mockResolvedValue(emptyDashboard(readiness));

    render(<InterventionPanel classNameFilter="All" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText(expected)).toBeVisible();
  });

  it('opens readiness details with real counts and clears active filters', async () => {
    const onClearFilters = vi.fn();
    mocks.getDashboard.mockResolvedValue(emptyDashboard({
      ...baseReadiness,
      studentsInScope: 15,
      resultsInWindow: 22,
      questionsInScope: 100,
      questionsWithSkillMetadata: 48,
      skillMetadataCoveragePercent: 48,
      eligibleSignals: 0,
      excludedSignals: {
        stable: 0,
        insufficientSamples: 6,
        lowConfidence: 3,
        missingMetadata: 52,
      },
    }));

    render(
      <InterventionPanel
        classNameFilter="4A"
        quizId="quiz-recommended"
        quizzes={quizzes}
        isOnline
        onClearFilters={onClearFilters}
      />,
    );

    const details = await screen.findByText('Xem chi tiết');
    fireEvent.click(details);
    expect(screen.getByText('48/100 câu có gắn kỹ năng')).toBeVisible();
    expect(screen.getByText('6 tín hiệu chưa đủ 3 mẫu')).toBeVisible();
    expect(screen.getByText('3 tín hiệu có độ tin cậy dưới 55%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('keeps active groups visible when there are no new suggestions', async () => {
    mocks.getDashboard.mockResolvedValue({ ...dashboard, suggestions: [] });

    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Nhóm đang theo dõi')).toBeVisible();
    expect(screen.getByText('Cần hỗ trợ ở Phân số')).toBeVisible();
  });

  it('shows a compact loading status before the first dashboard arrives', async () => {
    mocks.getDashboard.mockReturnValue(new Promise(() => {}));

    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByRole('status', { name: 'Đang phân tích dữ liệu hỗ trợ học sinh' })).toBeVisible();
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
