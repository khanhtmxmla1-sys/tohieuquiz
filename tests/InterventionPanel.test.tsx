import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterventionPanel } from '../src/components/teacher/ResultsView/InterventionPanel';
import type { InterventionDashboard, InterventionDataReadiness } from '../shared/intervention.contract';

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  createGroup: vi.fn(),
  addNote: vi.fn(),
  archiveGroup: vi.fn(),
  createAssignments: vi.fn(),
  previewAssignments: vi.fn(),
}));

vi.mock('../src/services/results/interventionService', () => ({
  getInterventionDashboard: mocks.getDashboard,
  createInterventionGroup: mocks.createGroup,
  addInterventionNote: mocks.addNote,
  archiveInterventionGroup: mocks.archiveGroup,
  createInterventionAssignments: mocks.createAssignments,
  previewInterventionAssignments: mocks.previewAssignments,
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

const secondStudent = {
  ...student,
  studentId: 'student-2',
  studentName: 'Minh',
  latestResultId: 'result-4',
  skillAccuracy: 45,
  skillSampleSize: 4,
  confidence: 0.65,
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
    evidence: {
      reason: 'LOW_ACCURACY',
      averageSkillAccuracy: 33,
      minimumSkillAccuracy: 33,
      recentAttemptCount: 3,
      improvingStudentCount: 1,
      unchangedStudentCount: 0,
      decliningStudentCount: 0,
    },
    students: [student],
    recommendedQuizzes: [{
      quizId: 'quiz-recommended',
      title: 'Luyện tập phân số',
      questionCount: 10,
      matchedQuestionCount: 8,
      confidence: 0.8,
    }],
  }],
  archivedGroups: [],
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
    progress: {
      status: 'WAITING_FOR_RESULTS',
      assignedCount: 1,
      completedCount: 0,
      completionPercent: 0,
      improvingCount: 0,
      needsAttentionCount: 0,
      waitingCount: 1,
      averageSkillAccuracyDelta: null,
      averageScoreDelta: null,
      evaluatedAt: '2026-07-29T08:00:00.000Z',
      members: [{
        studentId: 'student-1',
        baselineSkillAccuracy: 33,
        currentSkillAccuracy: null,
        skillAccuracyDelta: null,
        baselineScore: 6,
        currentScore: null,
        scoreDelta: null,
        assignedCount: 1,
        completedCount: 0,
        postInterventionSampleSize: 0,
        lastResultAt: null,
        status: 'WAITING_FOR_RESULTS',
      }],
    },
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
    mocks.archiveGroup.mockResolvedValue({
      groupId: 'group-1', status: 'ARCHIVED', reason: 'GOAL_REACHED', note: null,
      archivedAt: '2026-08-12T00:00:00.000Z',
    });
    mocks.addNote.mockResolvedValue({
      id: 'note-1', groupId: 'group-1', studentId: null,
      note: 'Ghi chú riêng', createdAt: '2026-07-29T09:00:00.000Z', updatedAt: '2026-07-29T09:00:00.000Z',
    });
    mocks.createAssignments.mockResolvedValue({
      groupId: 'group-1', assignmentIds: ['a-1'], skippedAssignmentIds: [], replayed: false,
    });
    mocks.previewAssignments.mockResolvedValue({
      groupId: 'group-1', quizId: 'quiz-recommended', memberCount: 1, openAssignmentCount: 0, assignableCount: 1,
    });
  });

  it('uses the new supportive title, shows scope and keeps a 44px accessible refresh target', async () => {
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByRole('heading', { name: 'Gợi ý hỗ trợ học sinh' })).toBeVisible();
    expect(screen.getByText('Lớp 4A')).toBeVisible();
    expect(screen.getByText('Tất cả bài kiểm tra')).toBeVisible();
    expect(screen.getByText('28 ngày')).toBeVisible();
    const refresh = screen.getByRole('button', { name: 'Làm mới gợi ý hỗ trợ học sinh' });
    expect(refresh).toHaveClass('min-h-11');
  });

  it('explains suggestion evidence with data-confidence copy', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [{
        ...dashboard.suggestions[0],
        evidence: {
          reason: 'LOW_ACCURACY',
          averageSkillAccuracy: 39,
          minimumSkillAccuracy: 33,
          recentAttemptCount: 7,
          improvingStudentCount: 0,
          unchangedStudentCount: 1,
          decliningStudentCount: 1,
        },
      } as any],
    });

    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Vì sao được gợi ý?')).toBeVisible();
    expect(screen.getByText(/Độ chính xác kỹ năng trung bình 39%/)).toBeVisible();
    expect(screen.getByText('Độ tin cậy dữ liệu 60%')).toBeVisible();
    expect(screen.queryByText(/^Tin cậy 60%$/)).not.toBeInTheDocument();
  });

  it('reviews members and submits only selected students with an editable group name', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [{
        ...dashboard.suggestions[0],
        studentCount: 2,
        sampleSize: 7,
        students: [student, secondStudent],
      }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    await screen.findAllByText('Cần hỗ trợ ở Phân số');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nhóm hỗ trợ' }));
    expect(mocks.createGroup).not.toHaveBeenCalled();

    const groupName = screen.getByLabelText('Tên nhóm hỗ trợ');
    expect(groupName).toHaveValue('Hỗ trợ Phân số — 4A');
    expect(screen.getByRole('checkbox', { name: /Lan/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Minh/ })).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả học sinh' }));
    expect(screen.getByRole('button', { name: 'Xác nhận tạo nhóm' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả học sinh' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minh/ }));
    fireEvent.change(groupName, { target: { value: 'Nhóm phân số cần theo dõi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo nhóm' }));

    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      suggestionKey: 'class-1:math:phan_so',
      className: '4A',
      name: 'Nhóm phân số cần theo dõi',
      studentIds: ['student-1'],
    })));
  });

  it('reloads a stale suggestion and keeps still-valid member selection', async () => {
    const suggestion = {
      ...dashboard.suggestions[0],
      studentCount: 2,
      sampleSize: 7,
      students: [student, secondStudent],
    };
    mocks.getDashboard.mockResolvedValue({ ...dashboard, suggestions: [suggestion] });
    mocks.createGroup.mockRejectedValueOnce(Object.assign(
      new Error('Intervention suggestion is no longer available'),
      { status: 409 },
    ));
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    await screen.findAllByText('Cần hỗ trợ ở Phân số');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nhóm hỗ trợ' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Minh/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo nhóm' }));

    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: /Lan/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Minh/ })).not.toBeChecked();
  });

  it('prevents double-submit while group creation is in flight', async () => {
    mocks.createGroup.mockReturnValue(new Promise(() => {}));
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    await screen.findAllByText('Cần hỗ trợ ở Phân số');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nhóm hỗ trợ' }));
    const confirm = screen.getByRole('button', { name: 'Xác nhận tạo nhóm' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mocks.createGroup).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
  });

  it('moves focus to the newly created group after reload', async () => {
    const createdGroup = { ...dashboard.groups[0], id: 'group-new', name: 'Nhóm mới' };
    mocks.createGroup.mockResolvedValue(createdGroup);
    mocks.getDashboard
      .mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce({ ...dashboard, groups: [...dashboard.groups, createdGroup] });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    await screen.findAllByText('Cần hỗ trợ ở Phân số');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo nhóm hỗ trợ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo nhóm' }));

    await screen.findByText('Nhóm mới');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'intervention-group-group-new'));
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

  it('keeps assignment validation in the UI and explains when no recommended quiz exists', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      groups: [{ ...dashboard.groups[0], recommendedQuizzes: [] }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findByText('Nhóm đang theo dõi');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài luyện' }));
    expect(await screen.findByText('Chưa có bài luyện khớp trực tiếp kỹ năng này; bạn vẫn có thể chọn bài khác.')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Hạn hoàn thành'), { target: { value: '2020-01-01T00:00' } });
    expect(screen.getByText('Hạn hoàn thành phải ở tương lai.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Giao bài cho nhóm' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Số lượt làm'), { target: { value: '11' } });
    expect(screen.getByText('Số lượt làm phải từ 1 đến 10.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Giao bài cho nhóm' })).toBeDisabled();
  });

  it('keeps notes permission copy accurate and reaches assignment confirmation in two actions', async () => {
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findAllByText('Cần hỗ trợ ở Phân số');

    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết' }));
    expect(screen.getByText('Chỉ giáo viên phụ trách và quản trị viên được phép mới xem được')).toBeVisible();
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
    await waitFor(() => expect(mocks.previewAssignments).toHaveBeenCalledWith('group-1', 'quiz-recommended'));
    expect(screen.getByText('8/10 câu khớp kỹ năng · 80% mức khớp')).toBeVisible();
    expect(screen.getByText('Có thể tạo mới cho 1/1 học sinh · 0 học sinh đã có bài đang mở')).toBeVisible();
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

  it('retries assignment creation with the same idempotency key and shows created/skipped counts', async () => {
    mocks.createAssignments
      .mockRejectedValueOnce(new Error('Lỗi tạm thời khi giao bài.'))
      .mockResolvedValueOnce({
        groupId: 'group-1', assignmentIds: ['a-1'], skippedAssignmentIds: ['a-open'], replayed: false,
      });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findByText('Nhóm đang theo dõi');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài luyện' }));
    await waitFor(() => expect(mocks.previewAssignments).toHaveBeenCalledWith('group-1', 'quiz-recommended'));
    const submit = screen.getByRole('button', { name: 'Giao bài cho nhóm' });
    fireEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi tạm thời khi giao bài.');
    expect(screen.getByLabelText('Bài kiểm tra')).toBeVisible();

    const firstKey = mocks.createAssignments.mock.calls[0][1].idempotencyKey;
    fireEvent.click(screen.getByRole('button', { name: 'Giao bài cho nhóm' }));
    await waitFor(() => expect(mocks.createAssignments).toHaveBeenCalledTimes(2));
    const secondKey = mocks.createAssignments.mock.calls[1][1].idempotencyKey;
    expect(secondKey).toBe(firstKey);
    expect(await screen.findByText('Đã tạo 1 bài mới · Bỏ qua 1 bài đang mở.')).toBeVisible();
  });
  it('shows waiting progress without rendering fake zero-to-zero metrics', async () => {
    mocks.getDashboard.mockResolvedValue({ ...dashboard, suggestions: [] });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Chờ kết quả mới')).toBeVisible();
    expect(screen.getByText('Đã giao 1 bài · Hoàn thành 0/1 (0%)')).toBeVisible();
    expect(screen.getByText('Chưa đủ dữ liệu mới')).toBeVisible();
    expect(screen.queryByText(/0%\s*→\s*0%/)).not.toBeInTheDocument();
  });

  it('shows improving progress with explicit skill and score deltas', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [],
      groups: [{
        ...dashboard.groups[0],
        progress: {
          ...dashboard.groups[0].progress,
          status: 'IMPROVING',
          assignedCount: 2,
          completedCount: 2,
          completionPercent: 100,
          improvingCount: 1,
          waitingCount: 0,
          averageSkillAccuracyDelta: 19,
          averageScoreDelta: 1.3,
          members: [{
            ...dashboard.groups[0].progress.members[0],
            currentSkillAccuracy: 52,
            skillAccuracyDelta: 19,
            currentScore: 7.3,
            scoreDelta: 1.3,
            assignedCount: 2,
            completedCount: 2,
            postInterventionSampleSize: 7,
            status: 'IMPROVING',
          }],
        },
      }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Đang tiến bộ')).toBeVisible();
    expect(screen.getByText('Đã giao 2 bài · Hoàn thành 2/2 (100%)')).toBeVisible();
    expect(screen.getByText('Độ chính xác kỹ năng: +19 điểm %')).toBeVisible();
    expect(screen.getByText('Điểm bài luyện: +1,3')).toBeVisible();
  });

  it('sorts member progress by attention priority and keeps text labels independent of color', async () => {
    const thirdStudent = { ...student, studentId: 'student-3', studentName: 'Hà' };
    const fourthStudent = { ...student, studentId: 'student-4', studentName: 'Dũng' };
    const progressMember = (studentId: string, status: 'IMPROVING' | 'STABLE' | 'WAITING_FOR_RESULTS' | 'NEEDS_ATTENTION') => ({
      studentId,
      baselineSkillAccuracy: 40,
      currentSkillAccuracy: status === 'WAITING_FOR_RESULTS' ? null : 45,
      skillAccuracyDelta: status === 'WAITING_FOR_RESULTS' ? null : 5,
      baselineScore: 5,
      currentScore: status === 'WAITING_FOR_RESULTS' ? null : 6,
      scoreDelta: status === 'WAITING_FOR_RESULTS' ? null : 1,
      assignedCount: 1,
      completedCount: status === 'WAITING_FOR_RESULTS' ? 0 : 1,
      postInterventionSampleSize: status === 'WAITING_FOR_RESULTS' ? 1 : 3,
      lastResultAt: status === 'WAITING_FOR_RESULTS' ? null : '2026-07-30T08:00:00.000Z',
      status,
    });
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [],
      groups: [{
        ...dashboard.groups[0],
        members: [student, secondStudent, thirdStudent, fourthStudent],
        progress: {
          ...dashboard.groups[0].progress,
          status: 'NEEDS_ATTENTION',
          members: [
            progressMember('student-1', 'IMPROVING'),
            progressMember('student-2', 'STABLE'),
            progressMember('student-3', 'WAITING_FOR_RESULTS'),
            progressMember('student-4', 'NEEDS_ATTENTION'),
          ],
        },
      }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findByText('Nhóm đang theo dõi');
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết' }));

    const list = screen.getByRole('list', { name: 'Tiến bộ từng học sinh' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Dũng'),
      expect.stringContaining('Hà'),
      expect.stringContaining('Minh'),
      expect.stringContaining('Lan'),
    ]);
    expect(rows[0]).toHaveTextContent('Cần tiếp tục hỗ trợ');
    expect(rows[1]).toHaveTextContent('Chờ kết quả mới');
  });

  it('sorts active groups by progress priority and shows progress filters only for larger lists', async () => {
    const makeGroup = (id: string, name: string, status: 'NEEDS_ATTENTION' | 'WAITING_FOR_RESULTS' | 'NO_ASSIGNMENT' | 'IMPROVING' | 'STABLE', updatedAt: string) => ({
      ...dashboard.groups[0],
      id,
      name,
      updatedAt,
      progress: { ...dashboard.groups[0].progress, status },
    });
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [],
      groups: [
        makeGroup('stable', 'Nhóm ổn định', 'STABLE', '2026-08-05T00:00:00.000Z'),
        makeGroup('improving', 'Nhóm tiến bộ', 'IMPROVING', '2026-08-06T00:00:00.000Z'),
        makeGroup('waiting', 'Nhóm chờ kết quả', 'WAITING_FOR_RESULTS', '2026-08-07T00:00:00.000Z'),
        makeGroup('no-assignment', 'Nhóm chưa giao bài', 'NO_ASSIGNMENT', '2026-08-08T00:00:00.000Z'),
        makeGroup('attention', 'Nhóm cần hỗ trợ ngay', 'NEEDS_ATTENTION', '2026-08-04T00:00:00.000Z'),
      ],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    await screen.findByText('Nhóm đang theo dõi');
    const headings = screen.getAllByRole('heading', { level: 4 });
    expect(headings[0]).toHaveTextContent('Nhóm cần hỗ trợ ngay');
    expect(screen.getByRole('button', { name: 'Cần hỗ trợ' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cần hỗ trợ' }));
    expect(screen.getByText('Nhóm cần hỗ trợ ngay')).toBeVisible();
    expect(screen.queryByText('Nhóm tiến bộ')).not.toBeInTheDocument();
  });
  it('requires a reason before archiving and explains that history is retained', async () => {
    mocks.getDashboard.mockResolvedValue({ ...dashboard, suggestions: [] });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findByText('Nhóm đang theo dõi');

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ nhóm' }));
    expect(screen.getByRole('dialog', { name: 'Lưu trữ nhóm hỗ trợ' })).toBeVisible();
    expect(screen.getByText(/vẫn giữ thành viên, ghi chú, bài đã giao và lịch sử/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xác nhận lưu trữ' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Lý do lưu trữ'), { target: { value: 'GOAL_REACHED' } });
    fireEvent.change(screen.getByLabelText('Ghi chú lưu trữ'), { target: { value: 'Nhóm đã đạt mục tiêu.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ' }));

    await waitFor(() => expect(mocks.archiveGroup).toHaveBeenCalledWith('group-1', {
      reason: 'GOAL_REACHED',
      note: 'Nhóm đã đạt mục tiêu.',
    }));
    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
  });

  it('keeps archived groups in a read-only Đã kết thúc disclosure', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [],
      groups: [],
      archivedGroups: [{ ...dashboard.groups[0], status: 'ARCHIVED' }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Đã kết thúc (1)')).toBeVisible();
    fireEvent.click(screen.getByText('Đã kết thúc (1)'));
    expect(screen.getByText('Cần hỗ trợ ở Phân số')).toBeVisible();
    expect(screen.getByText('Nhóm đã được lưu trữ và chỉ còn chế độ xem.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tạo bài luyện' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu trữ nhóm' })).not.toBeInTheDocument();
  });
  it('supports group or member-scoped private notes with a 2000-character counter', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...dashboard,
      suggestions: [],
      groups: [{ ...dashboard.groups[0], members: [student, secondStudent] }],
    });
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    await screen.findByText('Nhóm đang theo dõi');
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết' }));

    const scope = screen.getByLabelText('Phạm vi ghi chú') as HTMLSelectElement;
    expect(Array.from(scope.options).map((option) => option.textContent)).toEqual([
      'Cả nhóm',
      'Lan',
      'Minh',
    ]);
    fireEvent.change(scope, { target: { value: 'student-2' } });
    const note = screen.getByPlaceholderText(/Ghi lại hoàn cảnh/) as HTMLTextAreaElement;
    expect(note).toHaveAttribute('maxlength', '2000');
    fireEvent.change(note, { target: { value: 'Cần luyện thêm với Minh.' } });
    expect(screen.getByText('24/2.000')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));

    await waitFor(() => expect(mocks.addNote).toHaveBeenCalledWith('group-1', {
      note: 'Cần luyện thêm với Minh.',
      studentId: 'student-2',
    }));
  });
  it('ignores a stale dashboard response after filters change quickly', async () => {
    let resolveFirst: ((value: InterventionDashboard) => void) | undefined;
    const first = new Promise<InterventionDashboard>((resolve) => { resolveFirst = resolve; });
    const dashboardA = {
      ...dashboard,
      suggestions: [],
      groups: [{ ...dashboard.groups[0], id: 'group-a', name: 'Nhóm dữ liệu cũ' }],
    };
    const dashboardB = {
      ...dashboard,
      suggestions: [],
      groups: [{ ...dashboard.groups[0], id: 'group-b', name: 'Nhóm dữ liệu mới' }],
    };
    mocks.getDashboard
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(dashboardB);

    const { rerender } = render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    rerender(<InterventionPanel classNameFilter="4B" quizId="all" quizzes={quizzes} isOnline />);

    expect(await screen.findByText('Nhóm dữ liệu mới')).toBeVisible();
    await act(async () => {
      resolveFirst?.(dashboardA);
      await first;
    });
    expect(screen.getByText('Nhóm dữ liệu mới')).toBeVisible();
    expect(screen.queryByText('Nhóm dữ liệu cũ')).not.toBeInTheDocument();
  });

  it('keeps the last dashboard visible and marks it stale when refresh fails', async () => {
    mocks.getDashboard
      .mockResolvedValueOnce({ ...dashboard, suggestions: [] })
      .mockRejectedValueOnce(new Error('Mạng chập chờn'));
    render(<InterventionPanel classNameFilter="4A" quizId="all" quizzes={quizzes} isOnline />);
    expect(await screen.findByText('Cần hỗ trợ ở Phân số')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Làm mới gợi ý hỗ trợ học sinh' }));

    expect(await screen.findByText('Dữ liệu có thể đã cũ')).toBeVisible();
    expect(screen.getByText('Cần hỗ trợ ở Phân số')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Mạng chập chờn');
  });});
