import { useEffect } from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

const ADMIN_TABS: TeacherDashboardTab[] = ['announcements', 'feature-rollout', 'login-media', 'teachers', 'admin-templates', 'math-audit', 'operations', 'system-question-bank'];

export const isDashboardTabAllowed = (
  tab: TeacherDashboardTab,
  isAdmin: boolean,
  giftShopEnabled: boolean,
): boolean => (giftShopEnabled || tab !== 'gift-shop')
  && (isAdmin || !ADMIN_TABS.includes(tab));

export const useDashboardPermissions = (
  activeTab: TeacherDashboardTab,
  onInvalidTab: () => void,
  isAdmin: boolean,
  giftShopEnabled: boolean,
) => {
  useEffect(() => {
    if (!isDashboardTabAllowed(activeTab, isAdmin, giftShopEnabled)) onInvalidTab();
  }, [giftShopEnabled, activeTab, isAdmin, onInvalidTab]);
};
