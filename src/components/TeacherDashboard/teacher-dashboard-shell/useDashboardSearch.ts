import { useState } from 'react';
import type React from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { showError } from '../../../utils/toast';
import { DASHBOARD_SEARCH_ITEMS } from './dashboardConfig';

export const useDashboardSearch = (setActiveTab: (tab: TeacherDashboardTab) => void) => {
  const [searchQuery, setSearchQuery] = useState('');
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi-VN');
    if (!normalizedQuery) return;
    const destination = DASHBOARD_SEARCH_ITEMS.find(item => (
      `${item.label} ${item.keywords}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery)
    ));
    if (!destination) {
      showError('Không tìm thấy chức năng phù hợp.');
      return;
    }
    setActiveTab(destination.tab);
    setSearchQuery('');
  };
  return { searchQuery, setSearchQuery, submitSearch };
};
