import { Footer } from '../../common';
import PasswordChangeDialog from '../../common/PasswordChangeDialog';
import CurrentAnnouncementBanner from '../../common/CurrentAnnouncementBanner';
import { NotificationSurfaceStack } from '../../../features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '../../../features/notifications/useUnifiedNotificationsFeatureFlag';
import Sidebar from '../Sidebar';
import { AccessCodeDialog } from './AccessCodeDialog';
import { TeacherDashboardHeader } from './TeacherDashboardHeader';
import { TeacherDashboardTabContent } from './TeacherDashboardTabContent';
import TeacherMobileBottomNav from './TeacherMobileBottomNav';
import type { TeacherDashboardLayoutProps } from './types';

export const TeacherDashboardLayout = (props: TeacherDashboardLayoutProps) => {
  const notificationFlag = useUnifiedNotificationsFeatureFlag();
  return (
    <div className="teacher-dashboard-shell flex min-h-[100dvh] flex-col bg-[var(--color-dashboard-shell)] text-slate-900 lg:flex-row">
      {props.passwordGate && (
        <PasswordChangeDialog
          forced
          requireCurrentPassword={props.passwordGate.requireCurrentPassword}
          onComplete={props.completePasswordChange}
        />
      )}
      <Sidebar
        activeTab={props.activeTab}
        setActiveTab={props.selectTab}
        isGiftShopEnabled={props.giftShopEnabled}
        onLogout={props.onLogout}
        isMobileOpen={props.isMobileMenuOpen}
        setIsMobileOpen={props.setIsMobileMenuOpen}
      />
      <div className="flex min-h-[100dvh] min-w-0 w-full flex-1 flex-col lg:ml-[256px] lg:w-[calc(100%-256px)] lg:flex-none">
        <TeacherDashboardHeader
          activeTab={props.activeTab}
          setActiveTab={props.setActiveTab}
          manualQuizWorkspaceEnabled={props.manualQuizWorkspaceEnabled}
          onOpenMenu={() => props.setIsMobileMenuOpen(true)}
          searchQuery={props.searchQuery}
          setSearchQuery={props.setSearchQuery}
          onSearchSubmit={props.onSearchSubmit}
          searchOptions={props.searchOptions}
          teacherDisplayName={props.displayName}
          teacherInitial={props.teacherInitial}
          isAdmin={props.isAdmin}
          notificationUserId={props.username || ''}
          unifiedNotificationsReady={notificationFlag.ready}
          unifiedNotificationsEnabled={notificationFlag.enabled}
          onLogout={props.onLogout}
          onNotificationNavigate={(target) => {
            if (target.kind === 'assignment') props.setActiveTab('assignments');
            if (target.kind === 'result-report') props.setActiveTab('results');
            if (target.kind === 'certificate') props.setActiveTab('certificates');
            if (target.kind === 'live-exam') props.setActiveTab('live-exam');
            if (target.kind === 'url') props.onNavigate(target.url);
          }}
        />
        {notificationFlag.ready && (
          notificationFlag.enabled
            ? (
              <NotificationSurfaceStack
                surface="TEACHER_DASHBOARD"
                role={props.isAdmin ? 'admin' : 'teacher'}
              />
            )
            : <CurrentAnnouncementBanner role="teacher" />
        )}
        <main className="flex-1 overflow-x-hidden px-3 py-4 pb-24 sm:px-5 sm:py-6 sm:pb-24 lg:px-7 lg:py-7 lg:pb-8 xl:px-9 2xl:px-10">
          <TeacherDashboardTabContent
            activeTab={props.activeTab}
            setActiveTab={props.setActiveTab}
            selectTab={props.selectTab}
            manualQuizWorkspaceEnabled={props.manualQuizWorkspaceEnabled}
            onCreateQuizWithAi={props.onCreateQuizWithAi}
            onCreateQuizManually={props.onCreateQuizManually}
            resultsLoadState={props.resultsLoadState}
            resultsLoadError={props.resultsLoadError}
            loadTeacherResults={props.loadTeacherResults}
            resultSummary={props.resultSummary}
            summaryLoadState={props.summaryLoadState}
            summaryLoadError={props.summaryLoadError}
            filteredResults={props.filteredResults}
            quizzes={props.quizzes}
            editingQuiz={props.editingQuiz}
            setEditingQuiz={props.setEditingQuiz}
            openAccessCodeEditor={props.openAccessCodeEditor}
            removeQuiz={props.removeQuiz}
            createQuiz={props.createQuiz}
            modifyQuiz={props.modifyQuiz}
            isAdmin={props.isAdmin}
            giftShopEnabled={props.giftShopEnabled}
            username={props.username}
          />
        </main>
        <div className="hidden lg:block">
          <Footer onNavigate={props.onNavigate} showPublicLinks={false} />
        </div>
      </div>
      <TeacherMobileBottomNav
        activeTab={props.activeTab}
        onSelectTab={props.selectTab}
        onOpenMore={() => props.setIsMobileMenuOpen(true)}
      />
      <AccessCodeDialog
        editingAccessCode={props.editingAccessCode}
        newAccessCode={props.newAccessCode}
        setNewAccessCode={props.setNewAccessCode}
        onClose={props.closeAccessCodeEditor}
        onSave={props.updateAccessCode}
      />
    </div>
  );
};
