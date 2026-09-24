import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import { useClassStore } from '../src/stores/useClassStore';

const seed = {
    title: 'Kiểm tra giữa kỳ – Toán lớp 3',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 20,
    tags: [],
    requireCode: false,
    showOnHome: true,
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

describe('ManualQuizWorkspace desktop shell', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
        useClassStore.setState({
            classes: [
                { id: 'class-3a', name: 'Lớp 3A', teacherUsername: 'teacher-a', createdAt: '2026-08-01T00:00:00.000Z' },
                { id: 'class-4b', name: 'Lớp 4B', teacherUsername: 'teacher-a', createdAt: '2026-08-01T00:00:00.000Z' },
            ],
            isLoading: false,
            error: null,
            fetchClasses: async () => undefined,
        });
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô An',
            isAdmin: false,
        });
    });

    it('renders sticky header, full-width overview and sticky status bar', async () => {
        renderWorkspace();

        expect(await screen.findByRole('banner', { name: 'Thanh công cụ Trình soạn đề' })).toHaveClass('sticky');
        expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
        expect(screen.getByRole('main', { name: 'Tổng quan câu hỏi' })).toHaveAttribute('data-question-navigator-variant', 'overview');
        expect(screen.getByTestId('workspace-view-edit')).not.toBeVisible();
        expect(screen.getByTestId('workspace-view-preview')).not.toBeVisible();
        expect(screen.getByRole('status', { name: 'Trạng thái đề kiểm tra' })).toHaveClass('sticky');
        expect(screen.getByDisplayValue('Kiểm tra giữa kỳ – Toán lớp 3')).toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Danh sách câu hỏi' })).not.toBeInTheDocument();
        expect(screen.queryByRole('complementary', { name: 'Xem trước học sinh' })).not.toBeInTheDocument();
    });

    it('opens publish validation from the header and status bar', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        expect(screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Đóng kiểm tra xuất bản' }));

        fireEvent.click(screen.getByRole('button', { name: 'Xem lỗi' }));
        expect(screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).toBeInTheDocument();
    });

    it('opens quiz settings, applies a real class and duration, then updates the workspace', async () => {
        renderWorkspace();
        const settingsButton = await screen.findByRole('button', { name: 'Mở thiết lập đề' });

        fireEvent.click(settingsButton);
        const dialog = screen.getByRole('dialog', { name: 'Thiết lập đề' });
        const classSelect = screen.getByRole('combobox', { name: 'Lớp áp dụng' });
        const input = screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' });
        expect(classSelect).toHaveValue('class-3a');
        fireEvent.change(classSelect, { target: { value: 'class-4b' } });
        fireEvent.change(input, { target: { value: '45' } });
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thiết lập' }));

        expect(dialog).not.toBeInTheDocument();
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.classLevel).toBe('Lớp 4B');
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.timeLimit).toBe(45);
        expect(screen.getByRole('status', { name: 'Trạng thái đề kiểm tra' })).toHaveTextContent('45 phút');
    });

    it('opens the focused editor and returns to the overview without mobile pane tabs', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));

        expect(screen.getByRole('main', { name: 'Trình soạn câu hỏi' })).toBeInTheDocument();
        expect(screen.getByTestId('workspace-view-overview')).not.toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
        expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
        expect(screen.queryByRole('navigation', { name: 'Chuyển vùng soạn đề trên di động' })).not.toBeInTheDocument();
    });
});
