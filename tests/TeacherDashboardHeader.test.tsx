import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/notifications/components', () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));
vi.mock('../src/components/common/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell" />,
}));
vi.mock('../src/components/common/SchoolLogo', () => ({
  default: () => <span data-testid="school-logo" />,
}));
vi.mock('../src/components/TeacherDashboard/teacher-dashboard-shell/DashboardSearchForm', () => ({
  DashboardSearchForm: () => <div data-testid="dashboard-search" />,
}));
vi.mock('../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu', () => ({
  TeacherAccountMenu: () => <div data-testid="account-menu" />,
}));

import { TeacherDashboardHeader } from '../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader';

describe('TeacherDashboardHeader', () => {
  const renderHeader = (overrides: Partial<React.ComponentProps<typeof TeacherDashboardHeader>> = {}) => render(
    <TeacherDashboardHeader
      activeTab="coin-awards"
      setActiveTab={vi.fn()}
      manualQuizWorkspaceEnabled={false}
      onOpenMenu={vi.fn()}
      onOpenAiSettings={vi.fn()}
      searchQuery=""
      setSearchQuery={vi.fn()}
      onSearchSubmit={vi.fn()}
      searchOptions={[]}
      teacherDisplayName="Cô A"
      teacherInitial="A"
      isAdmin={false}
      notificationUserId="teacher-a"
      unifiedNotificationsReady={true}
      unifiedNotificationsEnabled={true}
      onLogout={vi.fn()}
      onNotificationNavigate={vi.fn()}
      {...overrides}
    />,
  );

  it('labels the coin awards route', () => {
    renderHeader();

    expect(screen.getAllByText('Thưởng xu')).toHaveLength(2);
  });

  it('opens account AI settings from the top-right gear button', () => {
    const onOpenAiSettings = vi.fn();
    renderHeader({ onOpenAiSettings });

    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt AI' }));

    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);
  });
});
