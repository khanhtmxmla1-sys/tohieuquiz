import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import {
  AdminTemplatesPage,
  AnnouncementSettings,
  AssignmentTab,
  ClassManagementTab,
  GiftShopTab,
  HomeworkTab,
  LiveExamTab,
  MathAuditPage,
  PersonalSettingsTab,
  TeacherCertificatesPage,
  TeacherManagementTab,
} from './dashboardLazyTabs';

interface TeacherDashboardFeatureTabsProps {
  activeTab: TeacherDashboardTab;
  isAdmin: boolean;
  giftShopEnabled: boolean;
  username?: string | null;
}

export const TeacherDashboardFeatureTabs = (props: TeacherDashboardFeatureTabsProps) => (
  <>
    {props.activeTab === 'announcements' && props.isAdmin && (
      <div className="mx-auto w-full max-w-[1440px]"><AnnouncementSettings /></div>
    )}
    {props.activeTab === 'classes' && (
      <ClassManagementTab isAdmin={props.isAdmin || false} username={props.username || null} />
    )}
    {props.activeTab === 'assignments' && <AssignmentTab />}
    {props.activeTab === 'teachers' && props.isAdmin && <TeacherManagementTab />}
    {props.activeTab === 'personal-settings' && <PersonalSettingsTab />}
    {props.activeTab === 'gift-shop' && props.giftShopEnabled && <GiftShopTab />}
    {props.activeTab === 'homework' && <HomeworkTab />}
    {props.activeTab === 'live-exam' && <LiveExamTab />}
    {props.activeTab === 'certificates' && <TeacherCertificatesPage />}
    {props.activeTab === 'admin-templates' && props.isAdmin && <AdminTemplatesPage />}
    {props.activeTab === 'math-audit' && props.isAdmin && <MathAuditPage />}
  </>
);
