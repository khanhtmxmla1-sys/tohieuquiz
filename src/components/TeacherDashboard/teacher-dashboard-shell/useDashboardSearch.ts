import { useMemo, useState } from 'react';
import type React from 'react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { showError } from '../../../utils/toast';
import { isDashboardTabAllowed } from './useDashboardPermissions';
import {
  DASHBOARD_SEARCH_ITEMS,
  type DashboardSearchDestination,
} from './dashboardConfig';

interface UseDashboardSearchOptions {
  onSelectTab: (tab: TeacherDashboardTab) => void;
  onCreateQuizManually: () => void;
  manualQuizWorkspaceEnabled: boolean;
  isAdmin: boolean;
  giftShopEnabled: boolean;
}

const normalizeSearchText = (value: string): string => value
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const tokenizeSearchText = (value: string): string[] => (
  normalizeSearchText(value).match(/[a-z0-9]+/g) ?? []
);

const destinationMatchesQuery = (
  destination: DashboardSearchDestination,
  queryTokens: string[],
): boolean => {
  const destinationTokens = new Set(tokenizeSearchText(`${destination.label} ${destination.keywords}`));
  return queryTokens.every((token) => destinationTokens.has(token));
};

export const useDashboardSearch = ({
  onSelectTab,
  onCreateQuizManually,
  manualQuizWorkspaceEnabled,
  isAdmin,
  giftShopEnabled,
}: UseDashboardSearchOptions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchOptions = useMemo<DashboardSearchDestination[]>(() => DASHBOARD_SEARCH_ITEMS
    .filter((item) => manualQuizWorkspaceEnabled || item.kind !== 'manual-quiz')
    .filter((item) => item.kind !== 'tab' || isDashboardTabAllowed(item.tab, isAdmin, giftShopEnabled))
    .map((item) => (
      !manualQuizWorkspaceEnabled && item.kind === 'tab' && item.tab === 'create'
        ? { ...item, label: 'Tạo đề mới' }
        : item
    )), [giftShopEnabled, isAdmin, manualQuizWorkspaceEnabled]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const queryTokens = tokenizeSearchText(searchQuery.trim());
    if (queryTokens.length === 0) return;

    const destination = searchOptions.find((item) => destinationMatchesQuery(item, queryTokens));
    if (!destination) {
      showError('Không tìm thấy chức năng phù hợp.');
      return;
    }

    if (destination.kind === 'manual-quiz') onCreateQuizManually();
    else onSelectTab(destination.tab);
    setSearchQuery('');
  };

  return { searchQuery, setSearchQuery, submitSearch, searchOptions };
};
