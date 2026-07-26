import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

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
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô An',
            isAdmin: false,
        });
    });

    it('renders sticky header, three independent panes and sticky status bar', async () => {
        renderWorkspace();

        expect(await screen.findByRole('banner', { name: 'Thanh công cụ phòng soạn đề' })).toHaveClass('sticky');
        expect(screen.getByRole('navigation', { name: 'Danh sách câu hỏi' })).toHaveAttribute('data-pane-width', '280');
        expect(screen.getByRole('main', { name: 'Trình soạn câu hỏi' })).toHaveClass(
            'h-full',
            'min-h-0',
            'overflow-y-auto',
        );
        expect(screen.getByRole('complementary', { name: 'Xem trước học sinh' })).toHaveAttribute('data-pane-width', '380');
        expect(screen.getByRole('status', { name: 'Trạng thái đề kiểm tra' })).toHaveClass('sticky');
        expect(screen.getByDisplayValue('Kiểm tra giữa kỳ – Toán lớp 3')).toBeInTheDocument();
        expect(screen.getByTestId('workspace-grid')).toHaveClass('min-h-0');
    });

    it('opens publish validation from the header and status bar', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        expect(screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Đóng kiểm tra xuất bản' }));

        fireEvent.click(screen.getByRole('button', { name: 'Xem lỗi' }));
        expect(screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).toBeInTheDocument();
    });

    it('collapses navigator and preview without removing the editor', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Thu gọn danh sách câu hỏi' }));
        fireEvent.click(screen.getByRole('button', { name: 'Thu gọn xem trước' }));

        expect(screen.queryByRole('navigation', { name: 'Danh sách câu hỏi' })).not.toBeInTheDocument();
        expect(screen.queryByRole('complementary', { name: 'Xem trước học sinh' })).not.toBeInTheDocument();
        expect(screen.getByRole('main', { name: 'Trình soạn câu hỏi' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mở danh sách câu hỏi' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mở xem trước' })).toBeInTheDocument();
    });
});
