import { CalendarDays, ChevronRight, Megaphone, Menu } from 'lucide-react';
import type React from 'react';
import type { NotificationTarget } from '../../../../shared/notifications.contract';
import { NotificationCenter } from '../../../features/notifications/components';
import NotificationBell from '../../common/NotificationBell';
import SchoolLogo from '../../common/SchoolLogo';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { formatSystemDateWithOptions } from '../../../utils/dateTime';
import type { DashboardSearchDestination } from './dashboardConfig';
import { DashboardSearchForm } from './DashboardSearchForm';
import { TeacherAccountMenu } from './TeacherAccountMenu';

interface TeacherDashboardHeaderProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  manualQuizWorkspaceEnabled: boolean;
  onOpenMenu: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  searchOptions: DashboardSearchDestination[];
  teacherDisplayName: string;
  teacherInitial: string;
  isAdmin: boolean;
  notificationUserId: string;
  unifiedNotificationsReady: boolean;
  unifiedNotificationsEnabled: boolean;
  onLogout: () => void;
  onNotificationNavigate: (target: NotificationTarget) => void;
}

const TAB_LABELS: Partial<Record<TeacherDashboardTab, string>> = {
  overview: 'Tổng quan', create: 'Tạo đề mới', manage: 'Quản lý đề', 'live-exam': 'Thi trực tiếp',
  assignments: 'Giao bài', homework: 'Bài tập tự luận', results: 'Kết quả học tập', classes: 'Lớp học',
  'gift-shop': 'Tiệm tạp hóa', certificates: 'Cấp chứng nhận', 'admin-templates': 'Mẫu chứng nhận',
  'personal-settings': 'Cài đặt cá nhân', announcements: 'Thông báo', teachers: 'Giáo viên',
  'math-audit': 'Theo dõi lỗi công thức', operations: 'Trạng thái hệ thống',
  'system-question-bank': 'Ngân hàng câu hỏi hệ thống',
};

export const TeacherDashboardHeader = (props: TeacherDashboardHeaderProps) => {
  const activeLabel = props.activeTab === 'create' && props.manualQuizWorkspaceEnabled
    ? 'Tạo đề bằng AI'
    : TAB_LABELS[props.activeTab] || 'Tổng quan';
  const formattedDateLabel = formatSystemDateWithOptions(new Date(), {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const dateLabel = formattedDateLabel.charAt(0).toUpperCase() + formattedDateLabel.slice(1);

  const notificationControl = props.unifiedNotificationsReady && (
    props.unifiedNotificationsEnabled
      ? <NotificationCenter onNavigate={props.onNotificationNavigate} />
      : (
        <NotificationBell
          userId={props.notificationUserId}
          onOpenCertificate={() => props.setActiveTab('certificates')}
          onOpenResultReport={() => props.setActiveTab('results')}
        />
      )
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-3 py-2 sm:px-5 lg:min-h-[76px] lg:px-8">
        <button
          type="button"
          aria-label="Mở menu điều hướng"
          onClick={props.onOpenMenu}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>

        <div className="flex items-center gap-2 lg:hidden">
          <span className="grid size-9 place-items-center rounded-xl bg-blue-50 p-1"><SchoolLogo size={32} /></span>
          <span className="hidden text-base font-bold text-slate-900 min-[390px]:inline">TôHiệu<span className="text-blue-600">Quiz</span></span>
        </div>

        <div className="hidden min-w-[190px] lg:block">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span>Trang chủ</span><ChevronRight aria-hidden="true" className="size-3.5" /><span>Dashboard giáo viên</span>
          </nav>
          <p className="mt-1 truncate text-base font-semibold text-slate-900">{activeLabel}</p>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <DashboardSearchForm
            searchQuery={props.searchQuery}
            setSearchQuery={props.setSearchQuery}
            onSubmit={props.onSearchSubmit}
            options={props.searchOptions}
          />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 xl:inline-flex">
            <CalendarDays aria-hidden="true" className="size-4 text-blue-600" />{dateLabel}
          </span>
          {notificationControl}
          {props.isAdmin && (
            <button
              type="button"
              aria-label="Quản lý thông báo"
              title="Quản lý thông báo"
              onClick={() => props.setActiveTab('announcements')}
              className={`hidden size-10 items-center justify-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:inline-flex ${props.activeTab === 'announcements' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Megaphone aria-hidden="true" className="size-5" />
            </button>
          )}
          <TeacherAccountMenu
            activeTab={props.activeTab}
            displayName={props.teacherDisplayName}
            initial={props.teacherInitial}
            accountLabel={props.notificationUserId}
            isAdmin={props.isAdmin}
            onNavigate={props.setActiveTab}
            onLogout={props.onLogout}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 lg:hidden">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">Dashboard giáo viên</p>
          <p className="truncate text-sm font-semibold text-slate-900">{activeLabel}</p>
        </div>
      </div>
    </header>
  );
};
