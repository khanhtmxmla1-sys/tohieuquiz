import StudentAchievementsPage from '@/src/features/certificates/StudentAchievementsPage';
import StudentResultReportsPage from '@/src/features/results/components/student-reports/StudentResultReportsPage';
import { NotificationSurfaceStack } from '@/src/features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '@/src/features/notifications/useUnifiedNotificationsFeatureFlag';
import CurrentAnnouncementBanner from '@/src/components/common/CurrentAnnouncementBanner';
import { getAvatarUrl } from '@/src/config/avatars';
import { StudentDashboardHeader } from '@/src/components/HomePage/student-dashboard';
import { StudentDashboardBody } from './StudentDashboardBody';
import type { StudentDashboardContentProps } from './content.types';

export const StudentDashboardContent = (props: StudentDashboardContentProps) => {
  const { studentSession, activeSection, giftShopEnabled, rewards } = props;
  const notificationFlag = useUnifiedNotificationsFeatureFlag();
  return <>
    <StudentDashboardHeader
      studentName={studentSession.fullName}
      className={studentSession.className}
      avatarUrl={studentSession.avatar ? getAvatarUrl(studentSession.avatar) : getAvatarUrl('default')}
      level={rewards.pet?.level || 1}
      coins={rewards.coins}
      activeSection={activeSection}
      giftShopEnabled={giftShopEnabled}
      studentId={studentSession.studentId}
      unifiedNotificationsReady={notificationFlag.ready}
      unifiedNotificationsEnabled={notificationFlag.enabled}
      onSelectSection={props.onSelectSection}
      onOpenAssignment={props.assignments.openAssignment}
      onOpenResultReport={props.onOpenResultReport}
      onOpenGiftShop={props.onOpenGiftShop}
      onOpenLiveExam={props.onOpenLiveExam}
      onOpenAvatar={props.onOpenAvatar}
      onOpenChangePassword={props.onOpenChangePassword}
      onLogout={props.onLogout}
    />
    {notificationFlag.ready && (
      notificationFlag.enabled
        ? <NotificationSurfaceStack surface="STUDENT_DASHBOARD" role="student" />
        : <CurrentAnnouncementBanner role="student" />
    )}
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-5 sm:px-5 md:pb-12 md:pt-8 lg:px-8">
      {activeSection === 'achievements'
        ? <StudentAchievementsPage />
        : activeSection === 'resultReports'
          ? <StudentResultReportsPage selectedReportId={props.selectedResultReportId} />
          : <StudentDashboardBody {...props} />}
    </main>
  </>;
};

export type { StudentDashboardContentProps, StudentDashboardSection } from './content.types';
