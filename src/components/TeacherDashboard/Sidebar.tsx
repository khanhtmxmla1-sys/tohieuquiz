import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookText,
  ChevronRight,
  ClipboardList,
  FileText,
  Gift,
  GraduationCap,
  Home,
  LayoutTemplate,
  List,
  LogOut,
  Radio,
} from 'lucide-react';
import SchoolLogo from '../common/SchoolLogo';
import { useAuthStore } from '../../../stores/authStore';
import type { TeacherDashboardTab } from '../../stores/useTeacherDashboardUIStore';

export interface SidebarProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  isGiftShopEnabled?: boolean;
  onLogout: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

type GroupKey = 'exams' | 'teaching' | 'students' | 'utilities' | 'certificates';

type NavItem = {
  id: TeacherDashboardTab;
  label: string;
  icon: React.ReactNode;
};

const GROUP_KEYS: GroupKey[] = ['exams', 'teaching', 'students', 'utilities', 'certificates'];

const groupForTab = (tab: TeacherDashboardTab): GroupKey | null => {
  if (['create', 'manage', 'live-exam'].includes(tab)) return 'exams';
  if (['assignments', 'homework', 'results'].includes(tab)) return 'teaching';
  if (tab === 'classes') return 'students';
  if (tab === 'gift-shop') return 'utilities';
  if (['certificates', 'admin-templates'].includes(tab)) return 'certificates';
  return null;
};

const getInitialOpenGroups = (activeTab: TeacherDashboardTab): Set<GroupKey> => {
  const fallback = new Set<GroupKey>(['exams']);

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
      // Persisted UI preference is optional.
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
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    const nextGroup = groupForTab(activeTab);
    if (!nextGroup) return;
    setOpenGroups((currentGroups) => {
      if (currentGroups.has(nextGroup)) return currentGroups;
      return new Set([...currentGroups, nextGroup]);
    });
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'tohieuquiz_dashboard_open_groups',
        JSON.stringify(Array.from(openGroups)),
      );
    } catch {
      // Persisting UI preference is optional.
    }
  }, [openGroups]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => setIsDesktopViewport(desktopQuery.matches);
    syncViewport();
    desktopQuery.addEventListener('change', syncViewport);
    return () => desktopQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileOpen, setIsMobileOpen]);

  const isMobileDrawerInactive = !isDesktopViewport && !isMobileOpen;

  const examItems: NavItem[] = [
    { id: 'manage', label: 'Quản lý đề', icon: <List className="size-5" /> },
    { id: 'live-exam', label: 'Thi trực tiếp', icon: <Radio className="size-5" /> },
  ];
  const teachingItems: NavItem[] = [
    { id: 'assignments', label: 'Giao bài', icon: <ClipboardList className="size-5" /> },
    { id: 'homework', label: 'Bài tập tự luận', icon: <BookText className="size-5" /> },
    { id: 'results', label: 'Kết quả học tập', icon: <FileText className="size-5" /> },
  ];
  const studentItems: NavItem[] = [
    { id: 'classes', label: 'Lớp học', icon: <GraduationCap className="size-5" /> },
  ];
  const utilityItems = useMemo<NavItem[]>(() => (
    isGiftShopEnabled
      ? [{ id: 'gift-shop', label: 'Tiệm tạp hóa', icon: <Gift className="size-5" /> }]
      : []
  ), [isGiftShopEnabled]);
  const certificateItems: NavItem[] = [
    { id: 'certificates', label: 'Cấp chứng nhận', icon: <Award className="size-5" /> },
    ...(authStore.isAdmin
      ? [{ id: 'admin-templates' as TeacherDashboardTab, label: 'Mẫu chứng nhận', icon: <LayoutTemplate className="size-5" /> }]
      : []),
  ];

  const navigateTo = (tab: TeacherDashboardTab) => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  const toggleGroup = (groupKey: GroupKey) => {
    setOpenGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);
      if (nextGroups.has(groupKey)) nextGroups.delete(groupKey);
      else nextGroups.add(groupKey);
      return nextGroups;
    });
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        type="button"
        onClick={() => navigateTo(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          isActive
            ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
            : 'border-transparent font-medium text-slate-600 hover:bg-white hover:text-slate-900'
        }`}
      >
        <span aria-hidden="true" className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
        <span>{item.label}</span>
      </button>
    );
  };

  const NavGroup = ({ title, items, groupKey }: { title: string; items: NavItem[]; groupKey: GroupKey }) => {
    if (items.length === 0) return null;
    const isOpen = openGroups.has(groupKey);
    const panelId = `teacher-sidebar-${groupKey}`;

    return (
      <section className="mb-1.5">
        <button
          type="button"
          onClick={() => toggleGroup(groupKey)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span className="text-xs font-semibold text-slate-500">{title}</span>
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-90 text-blue-600' : 'text-slate-400'}`}
          />
        </button>
        {isOpen && (
          <div id={panelId} className="mt-1 space-y-0.5">
            {items.map((item) => <NavButton key={item.id} item={item} />)}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 z-40 cursor-default bg-slate-950/30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        aria-label="Điều hướng quản trị"
        aria-hidden={isMobileDrawerInactive || undefined}
        inert={isMobileDrawerInactive || undefined}
        className={`fixed left-0 top-0 z-50 flex h-full w-[240px] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[1px_0_0_0_rgb(15_23_42_/_0.04)] transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-50 p-1">
              <SchoolLogo size={32} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              TôHiệu<span className="text-blue-600">Quiz</span>
            </span>
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3">
          <NavButton item={{ id: 'overview', label: 'Tổng quan', icon: <Home className="size-5" /> }} />
        </div>

        <nav
          aria-label="Các khu vực chức năng"
          className="flex-1 overflow-y-auto bg-slate-50/70 px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <NavGroup title="Đề thi" items={examItems} groupKey="exams" />
          <NavGroup title="Dạy và giao bài" items={teachingItems} groupKey="teaching" />
          <NavGroup title="Học sinh" items={studentItems} groupKey="students" />
          <NavGroup title="Tiện ích" items={utilityItems} groupKey="utilities" />
          <NavGroup title="Chứng nhận" items={certificateItems} groupKey="certificates" />
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            <LogOut aria-hidden="true" className="size-5" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
