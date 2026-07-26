import { useEffect } from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

const ADMIN_TABS: TeacherDashboardTab[] = ['announcements', 'teachers', 'admin-templates', 'math-audit'];

export const useDashboardPermissions = (
  activeTab: TeacherDashboardTab,
  setActiveTab: (tab: TeacherDashboardTab) => void,
  isAdmin: boolean,
  giftShopEnabled: boolean,
) => {
  useEffect(() => {
    if (!giftShopEnabled && activeTab === 'gift-shop') setActiveTab('overview');
    if (!isAdmin && ADMIN_TABS.includes(activeTab)) setActiveTab('overview');
  }, [giftShopEnabled, activeTab, isAdmin, setActiveTab]);
};
