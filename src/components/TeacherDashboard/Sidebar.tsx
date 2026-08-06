import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import SchoolLogo from '../common/SchoolLogo';
import { useAuthStore } from '../../../stores/authStore';
import type { TeacherDashboardTab } from '../../stores/useTeacherDashboardUIStore';
import TeacherDashboardVisual, { type TeacherDashboardVisualName } from './overview/TeacherDashboardVisual';

export interface SidebarProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  isGiftShopEnabled?: boolean;
  onLogout: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

type GroupKey = 'teaching' | 'class-management' | 'personal' | 'administration';
type NavItem = { id: TeacherDashboardTab; label: string; visual?: TeacherDashboardVisualName };
type NavGroupDefinition = { key: GroupKey; label: string; items: NavItem[] };

const GROUP_KEYS: GroupKey[] = ['teaching', 'class-management', 'personal', 'administration'];

const groupForTab = (tab: TeacherDashboardTab): GroupKey | null => {
  if (['create', 'manage', 'live-exam', 'assignments', 'homework', 'results'].includes(tab)) return 'teaching';
  if (['classes', 'gift-shop', 'certificates', 'admin-templates'].includes(tab)) return 'class-management';
  if (tab === 'personal-settings') return 'personal';
  if (['announcements', 'teachers', 'math-audit', 'operations', 'system-question-bank'].includes(tab)) return 'administration';
  return null;
};

const getInitialOpenGroups = (activeTab: TeacherDashboardTab): Set<GroupKey> => {
  const fallback = new Set<GroupKey>(['teaching', 'class-management']);
  if (typeof window !== 'undefined') {
    try {
      const storedValue = window.localStorage.getItem('tohieuquiz_dashboard_open_groups');
      const storedGroups = storedValue ? JSON.parse(storedValue) : [];
      if (Array.isArray(storedGroups)) {
        const validGroups = storedGroups.filter((group): group is GroupKey => GROUP_KEYS.includes(group));
        if (validGroups.length > 0) {
          fallback.clear();
          validGroups.forEach((group) => fallback.add(group));
        }
      }
    } catch {
      // Optional UI preference.
    }
  }
  const activeGroup = groupForTab(activeTab);
  if (activeGroup) fallback.add(activeGroup);
  return fallback;
};

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isGiftShopEnabled = false,
  onLogout,
  isMobileOpen = false,
  setIsMobileOpen = () => {},
}) => {
  const authStore = useAuthStore();
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(() => getInitialOpenGroups(activeTab));
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? true
      : window.matchMedia('(min-width: 1024px)').matches
  ));

  useEffect(() => {
    const nextGroup = groupForTab(activeTab);
    if (!nextGroup) return;
    setOpenGroups((current) => current.has(nextGroup) ? current : new Set([...current, nextGroup]));
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tohieuquiz_dashboard_open_groups', JSON.stringify(Array.from(openGroups)));
    } catch {
      // Optional UI preference.
    }
  }, [openGroups]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopViewport(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setIsMobileOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isMobileOpen, setIsMobileOpen]);

  const groups = useMemo<NavGroupDefinition[]>(() => [
    {
      key: 'teaching',
      label: 'Giảng dạy',
      items: [
        { id: 'create', label: 'Tạo đề bằng AI', visual: 'quiz-create' },
        { id: 'manage', label: 'Quản lý đề', visual: 'quiz-management' },
        { id: 'live-exam', label: 'Thi trực tiếp', visual: 'live-exam' },
        { id: 'assignments', label: 'Giao bài', visual: 'assignment' },
        { id: 'homework', label: 'Bài tập tự luận' },
        { id: 'results', label: 'Kết quả học tập', visual: 'results' },
      ],
    },
    {
      key: 'class-management',
      label: 'Quản lý lớp',
      items: [
        { id: 'classes', label: 'Lớp học', visual: 'classroom' },
        ...(isGiftShopEnabled ? [{ id: 'gift-shop' as TeacherDashboardTab, label: 'Tiệm tạp hóa' }] : []),
        { id: 'certificates', label: 'Cấp chứng nhận', visual: 'certificate' },
        ...(authStore.isAdmin ? [{ id: 'admin-templates' as TeacherDashboardTab, label: 'Mẫu chứng nhận' }] : []),
      ],
    },
    {
      key: 'personal',
      label: 'Cá nhân',
      items: [{ id: 'personal-settings', label: 'Cài đặt cá nhân' }],
    },
    {
      key: 'administration',
      label: 'Quản trị',
      items: authStore.isAdmin ? [
        { id: 'announcements', label: 'Quản lý thông báo' },
        { id: 'teachers', label: 'Quản lý giáo viên', visual: 'students' },
        { id: 'system-question-bank', label: 'Ngân hàng câu hỏi', visual: 'test' },
        { id: 'operations', label: 'Trạng thái hệ thống' },
      ] : [],
    },
  ], [authStore.isAdmin, isGiftShopEnabled]);

  const navigateTo = (tab: TeacherDashboardTab) => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        type="button"
        onClick={() => navigateTo(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isActive ? 'bg-blue-50 font-semibold text-blue-700' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
      >
        {item.visual ? (
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isActive ? 'bg-white' : 'bg-slate-50'}`} aria-hidden="true">
            <TeacherDashboardVisual name={item.visual} decorative className="size-8 object-contain" />
          </span>
        ) : <span className="w-9 shrink-0" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </button>
    );
  };

  const isMobileDrawerInactive = !isDesktopViewport && !isMobileOpen;

  return (
    <>
      {isMobileOpen && <button type="button" aria-label="Đóng menu điều hướng" className="fixed inset-0 z-40 cursor-default bg-slate-950/30 lg:hidden" onClick={() => setIsMobileOpen(false)} />}
      <aside
        aria-label="Điều hướng quản trị"
        aria-hidden={isMobileDrawerInactive || undefined}
        inert={isMobileDrawerInactive || undefined}
        className={`fixed left-0 top-0 z-50 flex h-full w-[256px] flex-col overflow-hidden border-r border-slate-200 bg-white transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 p-1"><SchoolLogo size={32} /></div>
            <span className="text-xl font-bold tracking-tight text-slate-900">TôHiệu<span className="text-blue-600">Quiz</span></span>
          </div>
        </div>

        <div className="px-3 pb-2 pt-4">
          <NavButton item={{ id: 'overview', label: 'Tổng quan', visual: 'quiz-create' }} />
        </div>

        <nav aria-label="Các khu vực chức năng" className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => {
            if (group.items.length === 0) return null;
            const isOpen = openGroups.has(group.key);
            const panelId = `teacher-sidebar-${group.key}`;
            return (
              <section key={group.key} className="mt-2">
                <button
                  type="button"
                  onClick={() => setOpenGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                    return next;
                  })}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {group.label}
                  <ChevronRight aria-hidden="true" className={`size-4 transition-transform ${isOpen ? 'rotate-90 text-blue-600' : ''}`} />
                </button>
                {isOpen && <div id={panelId} className="mt-1 space-y-0.5">{group.items.map((item) => <NavButton key={item.id} item={item} />)}</div>}
              </section>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 text-white">
            <p className="text-sm font-bold">Nâng cấp TôHiệu Pro</p>
            <p className="mt-1 text-xs leading-5 text-blue-50">Mở rộng công cụ và báo cáo nâng cao.</p>
          </div>
          <button type="button" onClick={onLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600">
            <LogOut aria-hidden="true" className="size-5" />Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
