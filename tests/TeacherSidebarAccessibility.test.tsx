import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../src/components/TeacherDashboard/Sidebar';
import { useAuthStore } from '../stores/authStore';

const renderSidebar = (options: {
    isMobileOpen?: boolean;
    setIsMobileOpen?: (open: boolean) => void;
    manualQuizWorkspaceEnabled?: boolean;
    setActiveTab?: (tab: any) => void;
    onCreateQuizWithAi?: () => void;
    onCreateQuizManually?: () => void;
} = {}) => render(
    <Sidebar
        activeTab="overview"
        setActiveTab={options.setActiveTab ?? vi.fn()}
        manualQuizWorkspaceEnabled={options.manualQuizWorkspaceEnabled ?? true}
        onCreateQuizWithAi={options.onCreateQuizWithAi ?? vi.fn()}
        onCreateQuizManually={options.onCreateQuizManually ?? vi.fn()}
        onLogout={vi.fn()}
        isMobileOpen={options.isMobileOpen}
        setIsMobileOpen={options.setIsMobileOpen}
    />,
);

describe('Teacher dashboard sidebar accessibility', () => {
    beforeEach(() => {
        localStorage.clear();
        useAuthStore.setState({ isAdmin: false });
    });

    it('removes the closed mobile drawer from keyboard and accessibility navigation', () => {
        const originalMatchMedia = window.matchMedia;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        });

        const { container } = renderSidebar({ isMobileOpen: false });
        const drawer = container.querySelector('aside');

        expect(drawer?.hasAttribute('inert')).toBe(true);
        expect(drawer?.getAttribute('aria-hidden')).toBe('true');

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        });
    });

    it('shows separate AI and manual creation actions and closes the mobile drawer before each action', () => {
        const onCreateQuizWithAi = vi.fn();
        const onCreateQuizManually = vi.fn();
        const setIsMobileOpen = vi.fn();
        renderSidebar({
            isMobileOpen: true,
            setIsMobileOpen,
            onCreateQuizWithAi,
            onCreateQuizManually,
        });

        const aiButton = screen.getByRole('button', { name: 'Tạo đề bằng AI' });
        const manualButton = screen.getByRole('button', { name: 'Soạn đề thủ công' });
        expect(aiButton).toHaveAttribute('type', 'button');
        expect(manualButton).toHaveAttribute('type', 'button');
        expect(screen.queryByRole('button', { name: 'Tạo đề mới' })).not.toBeInTheDocument();

        fireEvent.click(aiButton);
        expect(setIsMobileOpen).toHaveBeenCalledWith(false);
        expect(onCreateQuizWithAi).toHaveBeenCalledTimes(1);

        fireEvent.click(manualButton);
        expect(onCreateQuizManually).toHaveBeenCalledTimes(1);
    });

    it('keeps the single legacy create action when the manual workspace is disabled', () => {
        const setActiveTab = vi.fn();
        renderSidebar({ manualQuizWorkspaceEnabled: false, setActiveTab });

        fireEvent.click(screen.getByRole('button', { name: 'Tạo đề mới' }));

        expect(setActiveTab).toHaveBeenCalledWith('create');
        expect(screen.queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
    });

    it('does not expose navigation for removed legacy features', () => {
        renderSidebar();

        expect(screen.queryByText(/IOE/i)).not.toBeInTheDocument();
    });

    it('keeps account and system destinations out of the teacher sidebar', () => {
        renderSidebar();

        expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Đề thi' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Dạy và giao bài' })).toBeInTheDocument();
    });

    it('keeps account and system destinations out of the admin sidebar', () => {
        useAuthStore.setState({ isAdmin: true });
        renderSidebar();

        expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Chứng nhận' })).toBeInTheDocument();
    });

    it('keeps multiple navigation groups open and exposes accordion state', () => {
        renderSidebar();

        const examGroup = screen.getByRole('button', { name: 'Đề thi' });
        const teachingGroup = screen.getByRole('button', { name: 'Dạy và giao bài' });

        expect(examGroup.getAttribute('aria-expanded')).toBe('true');
        expect(teachingGroup.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(teachingGroup);

        expect(screen.getByRole('button', { name: 'Đề thi' }).getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: 'Dạy và giao bài' }).getAttribute('aria-expanded')).toBe('true');
    });

    it('closes an open mobile drawer when Escape is pressed', () => {
        const setIsMobileOpen = vi.fn();
        renderSidebar({ isMobileOpen: true, setIsMobileOpen });

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(setIsMobileOpen).toHaveBeenCalledWith(false);
    });
});
