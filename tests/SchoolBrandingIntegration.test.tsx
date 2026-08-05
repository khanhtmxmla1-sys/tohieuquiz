// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import LandingHeader from '../src/components/HomePage/components/LandingHeader';
import { StudentDashboardHeader } from '../src/components/HomePage/student-dashboard/StudentDashboardHeader';
import Sidebar from '../src/components/TeacherDashboard/Sidebar';
import { SCHOOL_LOGO_URL } from '../src/config/branding';

vi.mock('../src/features/notifications/components', () => ({
    NotificationCenter: () => null,
}));

vi.mock('../src/components/common/NotificationBell', () => ({
    default: () => null,
}));

const noop = () => undefined;

const expectSchoolLogo = (container: HTMLElement) => {
    expect(container.querySelector(`img[src="${SCHOOL_LOGO_URL}"]`)).not.toBeNull();
};

describe('school logo integration', () => {
    it('uses the school logo in the public landing header', () => {
        const { container } = render(
            <MemoryRouter>
                <LandingHeader />
            </MemoryRouter>,
        );

        expectSchoolLogo(container);
    });

    it('uses the school logo in the teacher sidebar without changing its header height', () => {
        const { container } = render(
            <Sidebar
                activeTab="overview"
                setActiveTab={vi.fn()}
                manualQuizWorkspaceEnabled
                onCreateQuizWithAi={vi.fn()}
                onCreateQuizManually={vi.fn()}
                onLogout={vi.fn()}
            />,
        );

        expectSchoolLogo(container);
        expect(container.querySelector('aside > div')).toHaveClass('h-16');
    });

    it('uses the school logo in the student dashboard header', () => {
        const { container } = render(
            <StudentDashboardHeader
                studentName="Học sinh"
                className="4A"
                avatarUrl="/avatar1.webp"
                level={1}
                coins={0}
                activeSection="dashboard"
                giftShopEnabled={false}
                studentId="student-1"
                unifiedNotificationsReady={false}
                unifiedNotificationsEnabled={false}
                onSelectSection={noop}
                onOpenAssignments={noop}
                onOpenPractice={noop}
                onOpenAssignment={noop}
                onOpenResultReport={noop}
                onOpenGiftShop={noop}
                onOpenLiveExam={noop}
                onOpenAvatar={noop}
                onOpenChangePassword={noop}
                onClearDeviceData={noop}
                onLogout={noop}
            />,
        );

        expectSchoolLogo(container);
        expect(container.querySelector('header > div')).toHaveClass('min-h-16');
    });
});
