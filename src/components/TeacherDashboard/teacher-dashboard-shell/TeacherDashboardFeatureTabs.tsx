import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { useSystemQuestionBankFeatureFlag } from '../../../features/question-bank/useSystemQuestionBankFeatureFlag';
import {
  AdminTemplatesPage,
  AnnouncementSettings,
  FeatureRolloutPage,
  LoginMediaAdminPage,
  AssignmentTab,
  ClassManagementTab,
  GiftShopTab,
  HomeworkTab,
  LiveExamTab,
  MathAuditPage,
  OperationsCenterPage,
  PersonalSettingsTab,
  SystemQuestionBankAdminPage,
  TeacherCertificatesPage,
  TeacherManagementTab,
} from './dashboardLazyTabs';

interface TeacherDashboardFeatureTabsProps {
  activeTab: TeacherDashboardTab;
  isAdmin: boolean;
  giftShopEnabled: boolean;
  username?: string | null;
}

const SystemQuestionBankAdminGate = () => {
  const questionBankFlag = useSystemQuestionBankFeatureFlag();
  if (!questionBankFlag.ready) {
    return <div role="status" className="grid min-h-48 place-items-center text-sm text-slate-500">Đang tải cấu hình ngân hàng câu hỏi…</div>;
  }
  return questionBankFlag.enabled
    ? <SystemQuestionBankAdminPage />
    : <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Ngân hàng câu hỏi hệ thống hiện đang tắt trong Feature Rollout.</div>;
};

export const TeacherDashboardFeatureTabs = (props: TeacherDashboardFeatureTabsProps) => (
  <>
    {props.activeTab === 'announcements' && props.isAdmin && (
      <div className="mx-auto w-full max-w-[1440px]"><AnnouncementSettings /></div>
    )}
    {props.activeTab === 'feature-rollout' && props.isAdmin && <FeatureRolloutPage />}
    {props.activeTab === 'login-media' && props.isAdmin && <LoginMediaAdminPage />}
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
    {props.activeTab === 'operations' && props.isAdmin && <OperationsCenterPage />}
    {props.activeTab === 'system-question-bank' && props.isAdmin && <SystemQuestionBankAdminGate />}
  </>
);
