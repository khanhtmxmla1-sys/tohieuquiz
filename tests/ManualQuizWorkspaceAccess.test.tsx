import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { QuestionType } from '../src/types';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import { saveLocalDraft } from '../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository';
import { useClassStore } from '../src/stores/useClassStore';

const editorService = vi.hoisted(() => ({
  getQuizEditorPayload: vi.fn(),
  createQuizVersion: vi.fn(),
}));
vi.mock('../src/features/manual-quiz-workspace/services/quizEditorService', () => editorService);

import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
};

const quiz = {
  id: 'quiz-a', title: 'Đề Toán đã nộp', classLevel: '4', category: 'toan', timeLimit: 20,
  createdAt: '2026-08-01T00:00:00.000Z', createdBy: 'teacher-a', questions: [],
  sourceType: 'ai' as const, parentQuizId: null, versionNumber: 1, revision: 4,
};

describe('ManualQuizWorkspace editor access integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useManualQuizWorkspaceStore.getState().reset();
    useClassStore.setState({
      classes: [{ id: 'class-4', name: 'Lớp 4', teacherUsername: 'teacher-a', createdAt: '2026-08-01T00:00:00.000Z' }],
      isLoading: false,
      error: null,
      fetchClasses: async () => undefined,
    });
    useAuthStore.setState({
      isLoggedIn: true, username: 'teacher-a', teacherName: 'Cô A', isAdmin: false,
    });
    useQuizStore.setState({ quizzes: [], selectedQuiz: null, quizzesLoadedAt: null });
  });

  it('loads an existing quiz in readonly mode and disables structural editing', async () => {
    saveLocalDraft({
      schemaVersion: 1,
      draftId: 'draft-stale',
      quizId: 'quiz-a',
      ownerUsername: 'teacher-a',
      revision: 2,
      quiz: {
        ...quiz,
        title: 'Bản nháp cục bộ không được phép hiển thị',
        questions: [],
      },
      selectedQuestionId: null,
      targetPoints: 10,
      updatedAt: '2026-08-02T00:00:00.000Z',
    });

    editorService.getQuizEditorPayload.mockResolvedValue({
      quiz,
      questions: [],
      editability: {
        mode: 'READONLY', canEditStructure: false, canCreateVersion: true,
        reason: 'HAS_SUBMISSIONS', requiresPublishedWarning: false,
        resultCount: 3, activeLiveExamCount: 0, openAssignmentCount: 1,
      },
    });

    render(
      <MemoryRouter initialEntries={['/teacher/quizzes/quiz-a/edit']}>
        <Routes>
          <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('đã có 3 bài nộp');
    await waitFor(() => expect(screen.getByDisplayValue('Đề Toán đã nộp')).toBeDisabled());
    expect(screen.getByText('Được tạo bằng AI')).toBeInTheDocument();
    expect(screen.getByText('Chỉ đọc – dữ liệu gốc được bảo vệ')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
    expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mở thiết lập đề' }));
    expect(screen.getByRole('dialog', { name: 'Thiết lập đề' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lớp áp dụng' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Áp dụng thiết lập' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' })).toBeEnabled();
  });

  it('opens a newly created version even when catalog refresh fails', async () => {
    const versionQuiz = {
      ...quiz,
      id: 'quiz-v2',
      title: 'Đề Toán đã nộp - Bản chỉnh sửa',
      parentQuizId: 'quiz-a',
      versionNumber: 2,
      revision: 1,
    };
    editorService.getQuizEditorPayload
      .mockResolvedValueOnce({
        quiz,
        questions: [],
        editability: {
          mode: 'READONLY', canEditStructure: false, canCreateVersion: true,
          reason: 'HAS_SUBMISSIONS', requiresPublishedWarning: false,
          resultCount: 3, activeLiveExamCount: 0, openAssignmentCount: 1,
        },
      })
      .mockResolvedValueOnce({
        quiz: versionQuiz,
        questions: [],
        editability: {
          mode: 'EDIT', canEditStructure: true, canCreateVersion: true,
          reason: null, requiresPublishedWarning: false,
          resultCount: 0, activeLiveExamCount: 0, openAssignmentCount: 0,
        },
      });
    editorService.createQuizVersion.mockResolvedValue({
      id: 'quiz-v2',
      title: versionQuiz.title,
      parentQuizId: 'quiz-a',
      versionNumber: 2,
      revision: 1,
    });
    useQuizStore.setState({
      loadQuizzes: vi.fn(async () => { throw new Error('catalog refresh failed'); }),
    });

    render(
      <MemoryRouter initialEntries={['/teacher/quizzes/quiz-a/edit']}>
        <Routes>
          <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/quizzes/quiz-v2/edit'));
    expect(editorService.createQuizVersion).toHaveBeenCalledWith(
      'quiz-a',
      'Đề Toán đã nộp - Bản chỉnh sửa',
    );
  });

  it('returns a readonly preview to the overview instead of opening an editor', async () => {
    const question = {
      id: 'q-readonly-preview', type: QuestionType.MCQ, question: 'Câu xem trước',
      options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 5,
    };
    editorService.getQuizEditorPayload.mockResolvedValue({
      quiz: { ...quiz, questions: [question] },
      questions: [question],
      editability: {
        mode: 'READONLY', canEditStructure: false, canCreateVersion: true,
        reason: 'HAS_SUBMISSIONS', requiresPublishedWarning: false,
        resultCount: 3, activeLiveExamCount: 0, openAssignmentCount: 1,
      },
    });

    render(
      <MemoryRouter initialEntries={['/teacher/quizzes/quiz-a/edit']}>
        <Routes>
          <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Xem câu 1' }));
    expect(screen.getByTestId('workspace-view-preview')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Về danh sách' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
    expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
    expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();
  });

  it('blocks question navigation when the current draft cannot be persisted locally', async () => {
    const questions = [
      {
        id: 'q-access-1', type: QuestionType.MCQ, question: 'Câu một',
        options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 5,
      },
      {
        id: 'q-access-2', type: QuestionType.MCQ, question: 'Câu hai',
        options: ['A', 'B'], correctAnswer: 'B', difficulty: 1, points: 5,
      },
    ];
    editorService.getQuizEditorPayload.mockResolvedValue({
      quiz: { ...quiz, questions: [] },
      questions,
      editability: {
        mode: 'EDIT', canEditStructure: true, canCreateVersion: true,
        reason: null, requiresPublishedWarning: false,
        resultCount: 0, activeLiveExamCount: 0, openAssignmentCount: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={['/teacher/quizzes/quiz-a/edit']}>
        <Routes>
          <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const secondQuestion = await screen.findByRole('button', { name: 'Chọn câu 2: Câu hai' });
    await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-access-1'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    fireEvent.click(secondQuestion);

    expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-access-1');
    expect(await screen.findByText(/chưa thể lưu bản nháp/i)).toBeInTheDocument();
  });
});
