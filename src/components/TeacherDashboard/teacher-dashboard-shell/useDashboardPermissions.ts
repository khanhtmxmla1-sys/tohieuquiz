import { useEffect } from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

const ADMIN_TABS: TeacherDashboardTab[] = ['announcements', 'feature-rollout', 'login-media', 'teachers', 'admin-templates', 'math-audit', 'operations', 'system-question-bank'];

export const isDashboardTabAllowed = (
  tab: TeacherDashboardTab,
  isAdmin: boolean,
  giftShopEnabled: boolean,
  competitionEnabled = false,
): boolean => (giftShopEnabled || tab !== 'gift-shop')
  && (competitionEnabled || tab !== 'competition')
  && (isAdmin || !ADMIN_TABS.includes(tab));

export const useDashboardPermissions = (
  activeTab: TeacherDashboardTab,
  onInvalidTab: () => void,
  isAdmin: boolean,
  giftShopEnabled: boolean,
  competitionEnabled = false,
) => {
  useEffect(() => {
    if (!isDashboardTabAllowed(activeTab, isAdmin, giftShopEnabled, competitionEnabled)) onInvalidTab();
  }, [giftShopEnabled, competitionEnabled, activeTab, isAdmin, onInvalidTab]);
};
