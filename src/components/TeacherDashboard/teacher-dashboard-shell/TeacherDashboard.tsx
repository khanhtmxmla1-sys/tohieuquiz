import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Quiz } from '../../../types';
import { useAuthStore } from '../../../../stores/authStore';
import { useQuizStore } from '../../../../stores/quizStore';
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
  const activeTab = useTeacherDashboardUIStore(state => state.activeTab);
  const setActiveTab = useTeacherDashboardUIStore(state => state.setActiveTab);
  const clearAssignmentComposerDraft = useTeacherDashboardUIStore(state => state.clearAssignmentComposerDraft);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const giftShopEnabled = isGiftShopFeatureEnabled();
  const accountGate = useTeacherAccountGate();
  const bootstrap = useTeacherDashboardBootstrap();
  const dashboardSearch = useDashboardSearch(setActiveTab);
  const accessCode = useAccessCodeEditor();
  const logout = useTeacherLogout(setActiveTab, clearAssignmentComposerDraft);

  useDashboardPermissions(activeTab, setActiveTab, authStore.isAdmin, giftShopEnabled);

  const displayName = getTeacherDisplayName(authStore.teacherName, authStore.username);
  const selectTab = (tab: TeacherDashboardTab) => {
    if (tab === 'create') setEditingQuiz(null);
    setActiveTab(tab);
  };

  return (
    <TeacherDashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
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
