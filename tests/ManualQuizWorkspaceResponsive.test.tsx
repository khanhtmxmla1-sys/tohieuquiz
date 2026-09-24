import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề responsive', classLevel: '3', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
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

describe('ManualQuizWorkspace responsive layout', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-responsive',
            teacherName: 'Cô Responsive',
            isAdmin: false,
        });
    });

    it('starts a new quiz in the full-width question overview', async () => {
        renderWorkspace();
        const workspace = await screen.findByTestId('manual-quiz-workspace');

        expect(workspace).toHaveClass('max-w-full', 'overflow-x-clip', 'min-h-[100dvh]', 'overflow-y-visible');
        expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
        expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();
        expect(screen.queryByRole('navigation', { name: 'Chuyển vùng soạn đề trên di động' })).not.toBeInTheDocument();
    });

    it('enters the focused editor after a quick-add action', async () => {
        renderWorkspace();
        await screen.findByTestId('workspace-view-overview');

        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        expect(screen.getByTestId('workspace-view-overview')).not.toBeVisible();
    });

    it('uses a separate preview mode instead of a permanent side pane', async () => {
        renderWorkspace();
        await screen.findByTestId('workspace-view-overview');
        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));
        fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));

        expect(screen.getByTestId('workspace-view-preview')).toBeVisible();
        expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();
        expect(screen.queryByRole('complementary', { name: 'Xem trước học sinh' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Quay lại sửa' }));
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
    });
});
