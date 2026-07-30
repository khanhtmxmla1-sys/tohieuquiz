import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Quiz } from '../../../types';
import { useAuthStore } from '../../../../stores/authStore';
import { useQuizStore } from '../../../../stores/quizStore';
import { getTeacherRoute, resolveTeacherTabFromLocation } from '../../../app/navigationRoutes';
import {
  type TeacherDashboardTab,
  useTeacherDashboardUIStore,
} from '../../../stores/useTeacherDashboardUIStore';
import { TeacherDashboardLayout } from './TeacherDashboardLayout';
import { isGiftShopFeatureEnabled } from './dashboardConfig';
import {
  filterTeacherResults,
  getTeacherDisplayName,
  getTeacherInitial,
} from './dashboardSelectors';
import { useAccessCodeEditor } from './useAccessCodeEditor';
import { useDashboardPermissions } from './useDashboardPermissions';
import { useDashboardSearch } from './useDashboardSearch';
import { useTeacherAccountGate } from './useTeacherAccountGate';
import { useTeacherDashboardBootstrap } from './useTeacherDashboardBootstrap';
import { useTeacherLogout } from './useTeacherLogout';

const TeacherDashboard = () => {
  const authStore = useAuthStore();
  const quizStore = useQuizStore();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = resolveTeacherTabFromLocation(location.pathname, location.search);
  const setLegacyActiveTab = useTeacherDashboardUIStore(state => state.setActiveTab);
  const clearAssignmentComposerDraft = useTeacherDashboardUIStore(state => state.clearAssignmentComposerDraft);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const giftShopEnabled = isGiftShopFeatureEnabled();
  const accountGate = useTeacherAccountGate();
  const bootstrap = useTeacherDashboardBootstrap();
  const navigateToTab = useCallback((tab: TeacherDashboardTab) => {
    navigate(getTeacherRoute(tab));
  }, [navigate]);
  const selectTab = useCallback((tab: TeacherDashboardTab) => {
    if (tab === 'create') setEditingQuiz(null);
    navigateToTab(tab);
  }, [navigateToTab]);
  const dashboardSearch = useDashboardSearch(selectTab);
  const accessCode = useAccessCodeEditor();
  const runLegacyLogout = useTeacherLogout(setLegacyActiveTab, clearAssignmentComposerDraft);
  const logout = () => {
    runLegacyLogout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    setLegacyActiveTab(activeTab);
  }, [activeTab, setLegacyActiveTab]);

  useDashboardPermissions(
    activeTab,
    () => navigate(getTeacherRoute('overview'), { replace: true }),
    authStore.isAdmin,
    giftShopEnabled,
  );

  const displayName = getTeacherDisplayName(authStore.teacherName, authStore.username);

  return (
    <TeacherDashboardLayout
      activeTab={activeTab}
      setActiveTab={navigateToTab}
      selectTab={selectTab}
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      giftShopEnabled={giftShopEnabled}
      passwordGate={accountGate.passwordGate}
      completePasswordChange={accountGate.completePasswordChange}
      displayName={displayName}
      teacherInitial={getTeacherInitial(displayName)}
      isAdmin={authStore.isAdmin}
      username={authStore.username}
      onLogout={logout}
      searchQuery={dashboardSearch.searchQuery}
      setSearchQuery={dashboardSearch.setSearchQuery}
      onSearchSubmit={dashboardSearch.submitSearch}
      resultsLoadState={bootstrap.resultsLoadState}
      resultsLoadError={bootstrap.resultsLoadError}
      loadTeacherResults={bootstrap.loadTeacherResults}
      resultSummary={bootstrap.resultSummary}
      summaryLoadState={bootstrap.summaryLoadState}
      summaryLoadError={bootstrap.summaryLoadError}
      filteredResults={filterTeacherResults(quizStore.results, authStore.isAdmin, authStore.teacherClass)}
      quizzes={quizStore.quizzes}
      editingQuiz={editingQuiz}
      setEditingQuiz={setEditingQuiz}
      openAccessCodeEditor={accessCode.openAccessCodeEditor}
      removeQuiz={quizStore.removeQuiz}
      createQuiz={quizStore.createQuiz}
      modifyQuiz={quizStore.modifyQuiz}
      editingAccessCode={accessCode.editingAccessCode}
      newAccessCode={accessCode.newAccessCode}
      setNewAccessCode={accessCode.setNewAccessCode}
      closeAccessCodeEditor={accessCode.closeAccessCodeEditor}
      updateAccessCode={accessCode.updateAccessCode}
      onNavigate={path => navigate(path)}
    />
  );
};

export default TeacherDashboard;
