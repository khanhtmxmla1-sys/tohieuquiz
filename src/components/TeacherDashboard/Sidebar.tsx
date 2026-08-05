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
    PlusCircle,
    Radio,
} from 'lucide-react';
import SchoolLogo from '../common/SchoolLogo';
import { useAuthStore } from '../../../stores/authStore';
import type { TeacherDashboardTab } from '../../stores/useTeacherDashboardUIStore';
import { QuizCreationActions } from './quiz-creation';

export interface SidebarProps {
    activeTab: TeacherDashboardTab;
    setActiveTab: (tab: TeacherDashboardTab) => void;
    manualQuizWorkspaceEnabled: boolean;
    onCreateQuizWithAi: () => void;
    onCreateQuizManually: () => void;
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

const GROUP_KEYS: GroupKey[] = [
    'exams',
    'teaching',
    'students',
    'utilities',
    'certificates',
];

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
            // Ignore malformed persisted state and use the default group.
        }
    }

    const activeGroup = groupForTab(activeTab);
    if (activeGroup) fallback.add(activeGroup);
    return fallback;
};

const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    setActiveTab,
    manualQuizWorkspaceEnabled,
    onCreateQuizWithAi,
    onCreateQuizManually,
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
            const nextGroups = new Set(currentGroups);
            nextGroups.add(nextGroup);
            return nextGroups;
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

    const runCreationAction = (action: () => void) => {
        setIsMobileOpen(false);
        action();
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
                className={`flex min-h-10 w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                        ? 'border-[#0EA5E9] bg-[#F0F9FF] font-semibold text-[#0284C7]'
                        : 'border-transparent font-medium text-[#526174] hover:bg-white hover:text-[#172033]'
                }`}
            >
                <span aria-hidden="true" className={isActive ? 'text-[#0284C7]' : 'text-[#7A8796]'}>{item.icon}</span>
                <span>{item.label}</span>
            </button>
        );
    };

    const NavGroup = ({
        title,
        items,
        groupKey,
    }: {
        title: string;
        items: NavItem[];
        groupKey: GroupKey;
    }) => {
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
                    className="flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
                >
                    <span className="text-xs font-semibold text-[#7A8796]">{title}</span>
                    <ChevronRight
                        aria-hidden="true"
                        className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-90 text-[#0284C7]' : 'text-[#9AA5B1]'}`}
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
                <div className="fixed inset-0 z-40 bg-[#172033]/30 lg:hidden" onClick={() => setIsMobileOpen(false)} />
            )}

            <aside
                aria-label="Điều hướng quản trị"
                aria-hidden={isMobileDrawerInactive || undefined}
                inert={isMobileDrawerInactive || undefined}
                className={`fixed left-0 top-0 z-50 flex h-full w-[248px] flex-col overflow-hidden border-r border-[#E5E7EB] bg-[#F8FAFC] transition-transform duration-300 ease-in-out ${
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                <div className="flex h-16 shrink-0 items-center border-b border-[#E5E7EB] bg-white px-4">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white p-0.5">
                            <SchoolLogo size={32} />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#172033]">
                            TôHiệu<span className="text-[#0EA5E9]">Quiz</span>
                        </span>
                    </div>
                </div>

                <div className="shrink-0 border-b border-[#E5E7EB] bg-white p-3">
                    {manualQuizWorkspaceEnabled ? (
                        <QuizCreationActions
                            layout="sidebar"
                            onCreateWithAi={() => runCreationAction(onCreateQuizWithAi)}
                            onCreateManually={() => runCreationAction(onCreateQuizManually)}
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => navigateTo('create')}
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0EA5E9] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                        >
                            <PlusCircle aria-hidden="true" className="size-5" />
                            Tạo đề mới
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => navigateTo('overview')}
                        aria-current={activeTab === 'overview' ? 'page' : undefined}
                        className={`mt-2 flex min-h-10 w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 text-left text-sm transition-colors ${
                            activeTab === 'overview'
                                ? 'border-[#0EA5E9] bg-[#F0F9FF] font-semibold text-[#0284C7]'
                                : 'border-transparent font-medium text-[#526174] hover:bg-[#F8FAFC] hover:text-[#172033]'
                        }`}
                    >
                        <Home aria-hidden="true" className="size-5" />
                        Tổng quan
                    </button>
                </div>

                <nav
                    aria-label="Các khu vực chức năng"
                    className="flex-1 overflow-y-auto px-2 py-3"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB transparent' }}
                >
                    <NavGroup title="Đề thi" items={examItems} groupKey="exams" />
                    <NavGroup title="Dạy và giao bài" items={teachingItems} groupKey="teaching" />
                    <NavGroup title="Học sinh" items={studentItems} groupKey="students" />
                    <NavGroup title="Tiện ích" items={utilityItems} groupKey="utilities" />
                    <NavGroup title="Chứng nhận" items={certificateItems} groupKey="certificates" />
                </nav>

                <div className="shrink-0 border-t border-[#E5E7EB] bg-white p-3">
                    <button
                        type="button"
                        onClick={onLogout}
                        className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-[#B94733] transition-colors hover:bg-[#FFF4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51]"
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
