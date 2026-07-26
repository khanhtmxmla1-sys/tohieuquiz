import { Footer } from '../../common';
import PasswordChangeDialog from '../../common/PasswordChangeDialog';
import CurrentAnnouncementBanner from '../../common/CurrentAnnouncementBanner';
import { NotificationSurfaceStack } from '../../../features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '../../../features/notifications/useUnifiedNotificationsFeatureFlag';
import Sidebar from '../Sidebar';
import { AccessCodeDialog } from './AccessCodeDialog';
import { TeacherDashboardHeader } from './TeacherDashboardHeader';
import { TeacherDashboardTabContent } from './TeacherDashboardTabContent';
import type { TeacherDashboardLayoutProps } from './types';

export const TeacherDashboardLayout = (props: TeacherDashboardLayoutProps) => {
  const notificationFlag = useUnifiedNotificationsFeatureFlag();
  return (
  <div className="teacher-dashboard-shell flex min-h-screen flex-col bg-[#FFFDF7] text-[#172033] lg:flex-row">
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
    <div className="flex min-h-screen min-w-0 w-full flex-1 flex-col lg:ml-[248px] lg:w-[calc(100%-248px)] lg:flex-none">
      <TeacherDashboardHeader
        activeTab={props.activeTab}
        setActiveTab={props.setActiveTab}
        onOpenMenu={() => props.setIsMobileMenuOpen(true)}
        searchQuery={props.searchQuery}
        setSearchQuery={props.setSearchQuery}
        onSearchSubmit={props.onSearchSubmit}
        teacherDisplayName={props.displayName}
        teacherInitial={props.teacherInitial}
        isAdmin={props.isAdmin}
        notificationUserId={props.username}
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
      <main className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <TeacherDashboardTabContent
          activeTab={props.activeTab}
          setActiveTab={props.setActiveTab}
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
