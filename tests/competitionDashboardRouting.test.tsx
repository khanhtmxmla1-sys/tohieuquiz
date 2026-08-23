import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTeacherRoute, resolveTeacherTabFromLocation } from '../src/app/navigationRoutes';
import Sidebar from '../src/components/TeacherDashboard/Sidebar';
import { TeacherDashboardFeatureTabs } from '../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardFeatureTabs';
import { isDashboardTabAllowed } from '../src/components/TeacherDashboard/teacher-dashboard-shell/useDashboardPermissions';
import { useAuthStore } from '../stores/authStore';

const renderSidebar = (competitionEnabled: boolean) => render(
  <Sidebar
    {...({
      activeTab: 'overview',
      setActiveTab: vi.fn(),
      onLogout: vi.fn(),
      competitionEnabled,
    } as any)}
  />,
);

describe('Competition V1 teacher dashboard routing gate', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ isAdmin: false });
  });

  it('maps the competition dashboard to a stable teacher URL', () => {
    expect(getTeacherRoute('competition' as any)).toBe('/teacher/competition');
    expect(resolveTeacherTabFromLocation('/teacher/competition', '')).toBe('competition');
  });

  it('allows the competition tab only while the rollout flag is enabled', () => {
    expect(isDashboardTabAllowed('competition' as any, false, false, false)).toBe(false);
    expect(isDashboardTabAllowed('competition' as any, false, false, true)).toBe(true);
  });

  it('exposes competition navigation only when the rollout flag is enabled', () => {
    const disabled = renderSidebar(false);
    expect(screen.queryByRole('button', { name: 'Cuộc thi' })).not.toBeInTheDocument();
    disabled.unmount();

    renderSidebar(true);
    expect(screen.getByRole('button', { name: 'Cuộc thi' })).toBeInTheDocument();
  });

  it('renders the competition surface only when the rollout flag is enabled', async () => {
    const disabled = render(
      <TeacherDashboardFeatureTabs
        {...({ activeTab: 'competition', isAdmin: false, giftShopEnabled: false, competitionEnabled: false } as any)}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Cuộc thi' })).not.toBeInTheDocument();
    disabled.unmount();

    render(
      <React.Suspense fallback={<div role="status">Đang tải</div>}>
        <TeacherDashboardFeatureTabs
          {...({ activeTab: 'competition', isAdmin: false, giftShopEnabled: false, competitionEnabled: true } as any)}
        />
      </React.Suspense>,
    );
    expect(await screen.findByRole('heading', { name: 'Cuộc thi' })).toBeInTheDocument();
  });
});
