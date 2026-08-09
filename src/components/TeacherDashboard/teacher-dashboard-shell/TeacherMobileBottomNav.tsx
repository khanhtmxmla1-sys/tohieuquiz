import React from 'react';
import {
  BarChart3,
  FileText,
  Home,
  LayoutGrid,
  UsersRound,
} from 'lucide-react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

interface TeacherMobileBottomNavProps {
  activeTab: TeacherDashboardTab;
  onSelectTab: (tab: TeacherDashboardTab) => void;
  onOpenMore: () => void;
}

const items = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'manage', label: 'Đề thi', icon: FileText },
  { id: 'classes', label: 'Học sinh', icon: UsersRound },
  { id: 'results', label: 'Kết quả', icon: BarChart3 },
] as const satisfies ReadonlyArray<{
  id: TeacherDashboardTab;
  label: string;
  icon: React.ElementType;
}>;

const TeacherMobileBottomNav: React.FC<TeacherMobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMore,
}) => {
  const isMoreActive = !items.some(({ id }) => id === activeTab);

  return (
  <nav
    aria-label="Điều hướng nhanh"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(15_23_42_/_0.08)] backdrop-blur lg:hidden"
  >
    <div className="grid h-16 grid-cols-5 px-1">
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTab(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
              isActive ? 'text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Icon aria-hidden="true" className={`size-5 ${isActive ? 'fill-blue-100' : ''}`} />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        aria-label="Thêm"
        aria-current={isMoreActive ? 'page' : undefined}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
          isMoreActive ? 'text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      >
        <LayoutGrid aria-hidden="true" className={`size-5 ${isMoreActive ? 'fill-blue-100' : ''}`} />
        <span>Thêm</span>
      </button>
    </div>
  </nav>
  );
};

export default TeacherMobileBottomNav;
