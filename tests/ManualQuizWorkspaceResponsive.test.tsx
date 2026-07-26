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

    it('declares mobile, tablet and desktop layout constraints without horizontal overflow', async () => {
        renderWorkspace();
        const workspace = await screen.findByTestId('manual-quiz-workspace');
        const grid = screen.getByTestId('workspace-grid');
        const navigator = screen.getByRole('navigation', { name: 'Danh sách câu hỏi' });
        const preview = screen.getByRole('complementary', { name: 'Xem trước học sinh' });

        expect(workspace).toHaveClass('max-w-full', 'overflow-x-hidden', 'h-[100dvh]');
        expect(grid).toHaveClass(
            'grid-cols-1',
            'md:grid-cols-[280px_minmax(0,1fr)]',
            'xl:grid-cols-[280px_minmax(0,1fr)_380px]',
        );
        expect(navigator).toHaveClass('w-full', 'md:w-[280px]', 'min-w-0');
        expect(preview).toHaveClass(
            'w-full',
            'md:fixed',
            'md:w-[380px]',
            'xl:static',
            'xl:w-[380px]',
        );
        expect(screen.getByRole('navigation', { name: 'Chuyển vùng soạn đề trên di động' })).toHaveClass('md:hidden');
    });

    it('switches the three mobile panes while tablet panes remain breakpoint-controlled', async () => {
        renderWorkspace();
        await screen.findByTestId('workspace-grid');

        expect(screen.getByRole('tab', { name: 'Soạn' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('workspace-pane-editor')).toHaveAttribute('data-mobile-visible', 'true');
        expect(screen.getByTestId('workspace-pane-list')).toHaveClass('hidden', 'md:block');

        fireEvent.click(screen.getByRole('tab', { name: 'Danh sách' }));
        expect(screen.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('workspace-pane-list')).toHaveAttribute('data-mobile-visible', 'true');
        expect(screen.getByTestId('workspace-pane-editor')).toHaveClass('hidden', 'md:block');

        fireEvent.click(screen.getByRole('tab', { name: 'Xem trước' }));
        expect(screen.getByRole('tab', { name: 'Xem trước' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('workspace-pane-preview')).toHaveAttribute('data-mobile-visible', 'true');
    });

    it('keeps bottom actions inside safe-area and uses preview as a tablet drawer', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        const tabs = screen.getByRole('navigation', { name: 'Chuyển vùng soạn đề trên di động' });
        expect(tabs.className).toContain('safe-area-inset-bottom');

        const preview = screen.getByRole('complementary', { name: 'Xem trước học sinh' });
        expect(preview).toHaveClass('md:fixed', 'md:top-[72px]', 'md:bottom-12', 'md:shadow-2xl');
        fireEvent.click(screen.getByRole('button', { name: 'Đóng khung xem trước' }));
        expect(screen.queryByRole('complementary', { name: 'Xem trước học sinh' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Mở xem trước' }));
        expect(screen.getByRole('complementary', { name: 'Xem trước học sinh' })).toBeInTheDocument();
    });
});
