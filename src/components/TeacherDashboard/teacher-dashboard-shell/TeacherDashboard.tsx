import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Quiz } from '../../../types';
import { useAuthStore } from '../../../../stores/authStore';
import { useQuizStore } from '../../../../stores/quizStore';
import {
  getQuizEditorRoute,
  getTeacherRoute,
  resolveTeacherTabFromLocation,
} from '../../../app/navigationRoutes';
import {
  type TeacherDashboardTab,
  useTeacherDashboardUIStore,
} from '../../../stores/useTeacherDashboardUIStore';
import { isManualQuizWorkspaceEnabled } from '../../../config/featureFlags';
import { buildManualQuizSeed } from '../../../features/manual-quiz-workspace/domain/manualQuizSeed';
import { useManualQuizWorkspaceStore } from '../../../features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import { TeacherDashboardLayout } from './TeacherDashboardLayout';
import { isGiftShopFeatureEnabled } from './dashboardConfig';
import {
  filterTeacherResults,
  getTeacherDisplayName,
  getTeacherInitial,
} from './dashboardSelectors';
import { useAccessCodeEditor } from './useAccessCodeEditor';
import { isDashboardTabAllowed, useDashboardPermissions } from './useDashboardPermissions';
import { useDashboardSearch } from './useDashboardSearch';
import { useTeacherAccountGate } from './useTeacherAccountGate';
import { useTeacherDashboardBootstrap } from './useTeacherDashboardBootstrap';
import { useTeacherLogout } from './useTeacherLogout';

const TeacherDashboard = () => {
  const authStore = useAuthStore();
  const quizStore = useQuizStore();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedTab = resolveTeacherTabFromLocation(location.pathname, location.search);
  const setLegacyActiveTab = useTeacherDashboardUIStore(state => state.setActiveTab);
  const clearAssignmentComposerDraft = useTeacherDashboardUIStore(state => state.clearAssignmentComposerDraft);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const giftShopEnabled = isGiftShopFeatureEnabled();
  const manualQuizWorkspaceEnabled = isManualQuizWorkspaceEnabled();
  const activeTab = isDashboardTabAllowed(requestedTab, authStore.isAdmin, giftShopEnabled)
    ? requestedTab
    : 'overview';
  const accountGate = useTeacherAccountGate();
  const bootstrap = useTeacherDashboardBootstrap();

  const navigateToTab = useCallback((tab: TeacherDashboardTab) => {
    navigate(getTeacherRoute(tab));
  }, [navigate]);

  const selectTab = useCallback((tab: TeacherDashboardTab) => {
    if (tab === 'create') setEditingQuiz(null);
    navigateToTab(tab);
  }, [navigateToTab]);

  const openAiQuizCreator = useCallback(() => {
    selectTab('create');
  }, [selectTab]);

  const openManualQuizCreator = useCallback(() => {
    if (!manualQuizWorkspaceEnabled) return;
    const manualQuizSeed = buildManualQuizSeed({
      quizTitle: 'Đề kiểm tra mới',
      classLevel: authStore.teacherClass?.trim() || '3',
      category: 'toan',
      manualTimeLimit: 15,
      tags: [],
      requireCode: false,
      accessCode: '',
      showOnHome: true,
    });
    useManualQuizWorkspaceStore.getState().reset();
    navigate(getQuizEditorRoute(), {
      state: {
        manualQuizSeed,
        workspaceStartedAt: new Date().toISOString(),
      },
    });
  }, [authStore.teacherClass, manualQuizWorkspaceEnabled, navigate]);

  const dashboardSearch = useDashboardSearch({
    onSelectTab: selectTab,
    onCreateQuizManually: openManualQuizCreator,
    manualQuizWorkspaceEnabled,
    isAdmin: authStore.isAdmin,
    giftShopEnabled,
  });
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
    requestedTab,
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
      manualQuizWorkspaceEnabled={manualQuizWorkspaceEnabled}
      onCreateQuizWithAi={openAiQuizCreator}
      onCreateQuizManually={openManualQuizCreator}
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
      searchOptions={dashboardSearch.searchOptions}
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
