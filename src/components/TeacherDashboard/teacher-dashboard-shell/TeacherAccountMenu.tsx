import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  FlaskConical,
  LibraryBig,
  LogOut,
  Megaphone,
  ScanSearch,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import { useSystemQuestionBankFeatureFlag } from '../../../features/question-bank/useSystemQuestionBankFeatureFlag';

interface TeacherAccountMenuProps {
  activeTab: TeacherDashboardTab;
  displayName: string;
  initial: string;
  accountLabel?: string;
  isAdmin: boolean;
  onNavigate: (tab: TeacherDashboardTab) => void;
  onLogout: () => void;
}

type AdminMenuItem = {
  id: TeacherDashboardTab;
  label: string;
  icon: LucideIcon;
  requiresQuestionBankFlag?: boolean;
};

const ACCOUNT_MENU_ID = 'teacher-account-menu';
const ADMIN_MENU_ID = 'teacher-account-admin-menu';

const ADMIN_ITEMS: readonly AdminMenuItem[] = [
  { id: 'announcements', label: 'Quản lý thông báo', icon: Megaphone },
  { id: 'feature-rollout', label: 'Tính năng thử nghiệm', icon: FlaskConical },
  { id: 'login-media', label: 'Banner đăng nhập', icon: LibraryBig },
  { id: 'teachers', label: 'Quản lý giáo viên', icon: Users },
  { id: 'math-audit', label: 'Kiểm tra lỗi công thức', icon: ScanSearch },
  { id: 'operations', label: 'Trạng thái hệ thống', icon: ServerCog },
  { id: 'system-question-bank', label: 'Ngân hàng câu hỏi hệ thống', icon: LibraryBig, requiresQuestionBankFlag: true },
];

const navigationItemClass = (active: boolean) => [
  'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm',
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]',
  active
    ? 'bg-[#F0F9FF] font-semibold text-[#0284C7]'
    : 'font-medium text-[#526174] hover:bg-[#F8FAFC] hover:text-[#0284C7]',
].join(' ');

export const TeacherAccountMenu = ({
  activeTab,
  displayName,
  initial,
  accountLabel,
  isAdmin,
  onNavigate,
  onLogout,
}: TeacherAccountMenuProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const questionBankFlag = useSystemQuestionBankFeatureFlag();
  const adminItems = ADMIN_ITEMS.filter((item) => (
    !item.requiresQuestionBankFlag || (questionBankFlag.ready && questionBankFlag.enabled)
  ));
  const adminActive = adminItems.some((item) => item.id === activeTab);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isAdmin) setIsAdminOpen(false);
  }, [isAdmin]);

  const toggleMenu = () => {
    const nextOpen = !isOpen;
    if (nextOpen) setIsAdminOpen(adminActive);
    setIsOpen(nextOpen);
  };

  const navigateAndClose = (tab: TeacherDashboardTab) => {
    onNavigate(tab);
    setIsOpen(false);
  };

  const logoutAndClose = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div ref={rootRef} className="relative border-l border-[#E5E7EB] pl-2 sm:pl-3">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Mở menu tài khoản của ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={ACCOUNT_MENU_ID}
        onClick={toggleMenu}
        className="flex min-h-11 items-center gap-3 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
      >
        <span className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-semibold leading-tight text-[#172033]">{displayName}</span>
          <span className="text-xs font-medium text-[#64748B]">
            {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
          </span>
        </span>
        <span className="flex size-10 items-center justify-center rounded-full border border-[#BAE6FD] bg-[#0EA5E9] font-semibold text-white transition-colors hover:bg-[#0284C7]">
          {initial}
        </span>
      </button>

      {isOpen && (
        <div
          id={ACCOUNT_MENU_ID}
          role="menu"
          aria-label="Menu tài khoản giáo viên"
          className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-80px)] w-[300px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(23,32,51,0.10)]"
        >
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#BAE6FD] bg-white font-semibold text-[#0284C7]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#172033]">{displayName}</p>
              <p className="text-xs font-medium text-[#64748B]">
                {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
              </p>
              {accountLabel && (
                <p className="mt-0.5 truncate text-xs text-[#9AA5B1]" title={accountLabel}>
                  {accountLabel}
                </p>
              )}
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              aria-current={activeTab === 'personal-settings' ? 'page' : undefined}
              onClick={() => navigateAndClose('personal-settings')}
              className={navigationItemClass(activeTab === 'personal-settings')}
            >
              <Settings aria-hidden="true" className="size-[18px]" />
              <span>Cài đặt cá nhân</span>
            </button>

            {isAdmin && (
              <div className="mt-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={isAdminOpen}
                  aria-controls={ADMIN_MENU_ID}
                  onClick={() => setIsAdminOpen((open) => !open)}
                  className={navigationItemClass(adminActive)}
                >
                  <ShieldCheck aria-hidden="true" className="size-[18px]" />
                  <span className="flex-1">Quản trị hệ thống</span>
                  <ChevronRight
                    aria-hidden="true"
                    className={`size-4 transition-transform ${isAdminOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {isAdminOpen && (
                  <div
                    id={ADMIN_MENU_ID}
                    role="group"
                    aria-label="Các chức năng quản trị hệ thống"
                    className="ml-4 mt-1 space-y-0.5 border-l border-[#E5E7EB] pl-2"
                  >
                    {adminItems.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          aria-current={active ? 'page' : undefined}
                          onClick={() => navigateAndClose(item.id)}
                          className={navigationItemClass(active)}
                        >
                          <Icon aria-hidden="true" className="size-[18px]" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#E5E7EB] p-2">
            <button
              type="button"
              role="menuitem"
              onClick={logoutAndClose}
              className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[#526174] transition-colors hover:bg-[#FFF4F1] hover:text-[#B94733] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51]"
            >
              <LogOut aria-hidden="true" className="size-[18px]" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
