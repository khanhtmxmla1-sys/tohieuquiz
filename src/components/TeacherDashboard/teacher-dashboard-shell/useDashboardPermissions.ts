import { useEffect } from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

const ADMIN_TABS: TeacherDashboardTab[] = ['announcements', 'feature-rollout', 'teachers', 'admin-templates', 'math-audit', 'operations', 'system-question-bank'];

export const useDashboardPermissions = (
  activeTab: TeacherDashboardTab,
  onInvalidTab: () => void,
  isAdmin: boolean,
  giftShopEnabled: boolean,
) => {
  useEffect(() => {
    if (!giftShopEnabled && activeTab === 'gift-shop') onInvalidTab();
    if (!isAdmin && ADMIN_TABS.includes(activeTab)) onInvalidTab();
  }, [giftShopEnabled, activeTab, isAdmin, onInvalidTab]);
};
