import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { QuestionType } from '../src/types';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import {
    loadLocalDraft,
    saveLocalDraft,
} from '../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import type { ManualQuizDraftEnvelope } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';

const seed = {
    title: 'Đề mới từ biểu mẫu',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

const recoveredDraft: ManualQuizDraftEnvelope = {
    schemaVersion: 1,
    draftId: 'recover-me',
    ownerUsername: 'teacher-a',
    revision: 0,
    quiz: {
        id: 'quiz-local',
        title: 'Bản nháp đã lưu',
        classLevel: '3A',
        category: 'toan',
        timeLimit: 20,
        questions: [{
            id: 'q-local',
            type: QuestionType.MCQ,
            question: 'Câu hỏi đã lưu',
            options: ['A', 'B'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        }],
        createdAt: '2026-07-21T08:00:00.000Z',
    },
    selectedQuestionId: 'q-local',
    targetPoints: 10,
    updatedAt: '2026-07-21T09:00:00.000Z',
};

const renderWorkspace = () => render(
    <MemoryRouter initialEntries={[{
        pathname: '/teacher/quizzes/manual/new',
        state: { manualQuizSeed: seed },
    }]}>
        <Routes>
            <Route path="/teacher/quizzes/manual/new" element={<ManualQuizWorkspacePage />} />
        </Routes>
    </MemoryRouter>,
);

describe('manual quiz draft recovery', () => {
    beforeEach(() => {
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô An',
            isAdmin: false,
        });
        useQuizStore.setState({ quizzes: [] });
        saveLocalDraft(recoveredDraft);
    });

    it('continues the latest local draft after a reload-like entry', async () => {
        renderWorkspace();

        expect(await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).toBeInTheDocument();
        expect(screen.getByText('Bản nháp đã lưu')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục soạn' }));

        expect(await screen.findByDisplayValue('Bản nháp đã lưu')).toBeInTheDocument();
        expect(screen.getAllByText('Câu hỏi đã lưu').length).toBeGreaterThan(0);
    });

    it('discards the local draft and starts from the incoming seed', async () => {
        renderWorkspace();
        await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' });

        fireEvent.click(screen.getByRole('button', { name: 'Bỏ bản nháp' }));

        expect(await screen.findByDisplayValue('Đề mới từ biểu mẫu')).toBeInTheDocument();
        expect(loadLocalDraft('teacher-a', 'recover-me')).toBeNull();
    });
});
