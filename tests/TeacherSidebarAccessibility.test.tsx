import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '../src/components/TeacherDashboard/Sidebar';
import { useAuthStore } from '../stores/authStore';

const renderSidebar = (options: {
    isMobileOpen?: boolean;
    setIsMobileOpen?: (open: boolean) => void;
    setActiveTab?: (tab: any) => void;
} = {}) => render(
    <Sidebar
        activeTab="overview"
        setActiveTab={options.setActiveTab ?? vi.fn()}
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

    it('keeps creation choices out of navigation and places Overview directly below the logo', () => {
        const { container } = renderSidebar();
        const drawer = container.querySelector('aside');

        expect(screen.queryByRole('button', { name: 'Tạo đề bằng AI' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Tạo đề mới' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
        expect(drawer?.className).toContain('w-[240px]');
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
