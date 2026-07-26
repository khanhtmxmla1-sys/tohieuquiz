import { Megaphone, Menu } from 'lucide-react';
import type React from 'react';
import type { NotificationTarget } from '../../../../shared/notifications.contract';
import { NotificationCenter } from '../../../features/notifications/components';
import NotificationBell from '../../common/NotificationBell';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { DashboardSearchForm } from './DashboardSearchForm';
import { TeacherAccountMenu } from './TeacherAccountMenu';

interface TeacherDashboardHeaderProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  onOpenMenu: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
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
  overview: 'Tổng quan',
  create: 'Tạo đề mới',
  manage: 'Quản lý đề',
  'live-exam': 'Thi trực tiếp',
  assignments: 'Giao bài',
  homework: 'Bài tập tự luận',
  results: 'Kết quả học tập',
  classes: 'Lớp học',
  'gift-shop': 'Tiệm tạp hóa',
  certificates: 'Cấp chứng nhận',
  'admin-templates': 'Mẫu chứng nhận',
  'personal-settings': 'Cài đặt cá nhân',
  announcements: 'Thông báo',
  teachers: 'Giáo viên',
  'math-audit': 'Theo dõi lỗi công thức',
};

export const TeacherDashboardHeader = (props: TeacherDashboardHeaderProps) => (
  <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 sm:px-5 lg:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        aria-label="Mở menu điều hướng"
        onClick={props.onOpenMenu}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white text-[#526174] transition-colors hover:bg-[#F8FAFC] hover:text-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#7A8796]">Dashboard giáo viên</p>
        <p className="truncate text-sm font-semibold text-[#172033] sm:text-base">
          {TAB_LABELS[props.activeTab] || 'Tổng quan'}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-3">
      <DashboardSearchForm
        searchQuery={props.searchQuery}
        setSearchQuery={props.setSearchQuery}
        onSubmit={props.onSearchSubmit}
      />
      {props.unifiedNotificationsReady && (
        props.unifiedNotificationsEnabled
          ? <NotificationCenter onNavigate={props.onNotificationNavigate} />
          : (
            <NotificationBell
              userId={props.notificationUserId}
              onOpenCertificate={() => props.setActiveTab('certificates')}
              onOpenResultReport={() => props.setActiveTab('results')}
            />
          )
      )}
      {props.isAdmin && (
        <button
          type="button"
          aria-label="Quản lý thông báo"
          title="Quản lý thông báo"
          onClick={() => props.setActiveTab('announcements')}
          className={`hidden size-10 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] sm:inline-flex ${props.activeTab === 'announcements'
            ? 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0284C7]'
            : 'border-[#E5E7EB] bg-white text-[#526174] hover:bg-[#F8FAFC] hover:text-[#0284C7]'
          }`}
        >
          <Megaphone aria-hidden="true" className="size-5" />
        </button>
      )}
      <TeacherAccountMenu
        displayName={props.teacherDisplayName}
        initial={props.teacherInitial}
        isAdmin={props.isAdmin}
        onLogout={props.onLogout}
      />
    </div>
  </header>
);
