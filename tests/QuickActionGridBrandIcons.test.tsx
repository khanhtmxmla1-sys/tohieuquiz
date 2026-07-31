import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickActionGrid, {
    type DashboardQuickAction,
} from '../src/components/TeacherDashboard/overview/QuickActionGrid';

const actions: DashboardQuickAction[] = [
    {
        tab: 'create',
        title: 'Tạo đề mới',
        description: 'Bắt đầu xây dựng một đề kiểm tra.',
        icon: 'quiz-create',
        surfaceClassName: 'bg-sky-50',
    },
    {
        tab: 'assignments',
        title: 'Giao bài',
        description: 'Giao bài cho lớp học.',
        icon: 'assignment',
        surfaceClassName: 'bg-blue-50',
    },
    {
        tab: 'live-exam',
        title: 'Thi trực tiếp',
        description: 'Tổ chức phòng thi trực tiếp.',
        icon: 'live-exam',
        surfaceClassName: 'bg-amber-50',
    },
    {
        tab: 'results',
        title: 'Kết quả học tập',
        description: 'Theo dõi kết quả của học sinh.',
        icon: 'learning-results',
        surfaceClassName: 'bg-emerald-50',
    },
    {
        tab: 'classes',
        title: 'Lớp học',
        description: 'Quản lý danh sách lớp.',
        icon: 'classroom',
        surfaceClassName: 'bg-cyan-50',
    },
    {
        tab: 'certificates',
        title: 'Chứng nhận',
        description: 'Cấp chứng nhận cho học sinh.',
        icon: 'certificate',
        surfaceClassName: 'bg-amber-50',
    },
];

describe('QuickActionGrid brand icons', () => {
    it('renders the six TôHiệuQuiz module icons and preserves navigation', () => {
        const onSelect = vi.fn();
        const { container } = render(
            <QuickActionGrid actions={actions} onSelect={onSelect} />,
        );

        for (const action of actions) {
            expect(
                container.querySelector(
                    `img[src="/icons/tohieuquiz/${action.icon}.webp"]`,
                ),
            ).toBeInTheDocument();
        }

        fireEvent.click(screen.getByRole('button', { name: /Tạo đề mới/i }));
        expect(onSelect).toHaveBeenCalledWith('create');
    });
});
