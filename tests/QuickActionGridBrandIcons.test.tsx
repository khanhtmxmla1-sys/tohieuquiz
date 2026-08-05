import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickActionGrid, {
    type DashboardQuickAction,
} from '../src/components/TeacherDashboard/overview/QuickActionGrid';

const actions: DashboardQuickAction[] = [
    {
        tab: 'assignments',
        title: 'Giao bài',
        description: 'Giao bài cho lớp học.',
        visual: 'assignment',
        tone: 'blue',
    },
    {
        tab: 'live-exam',
        title: 'Thi trực tiếp',
        description: 'Tổ chức phòng thi trực tiếp.',
        visual: 'live-exam',
        tone: 'green',
    },
    {
        tab: 'results',
        title: 'Kết quả học tập',
        description: 'Theo dõi kết quả của học sinh.',
        visual: 'results',
        tone: 'rose',
    },
    {
        tab: 'classes',
        title: 'Lớp học',
        description: 'Quản lý danh sách lớp.',
        visual: 'classroom',
        tone: 'cyan',
    },
    {
        tab: 'certificates',
        title: 'Chứng nhận',
        description: 'Cấp chứng nhận cho học sinh.',
        visual: 'certificate',
        tone: 'orange',
    },
    {
        tab: 'manage',
        title: 'Quản lý đề',
        description: 'Mở danh sách đề kiểm tra.',
        visual: 'quiz-management',
        tone: 'violet',
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
                    `img[src="/icons/tohieuquiz/dashboard-v2/${action.visual}.webp"]`,
                ),
            ).toBeInTheDocument();
        }

        fireEvent.click(screen.getByRole('button', { name: /Giao bài/i }));
        expect(onSelect).toHaveBeenCalledWith('assignments');
    });
});
