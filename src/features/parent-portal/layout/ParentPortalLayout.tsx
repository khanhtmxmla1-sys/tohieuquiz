import React from 'react';
import { Award, Bell, BookOpen, CircleHelp, GraduationCap, Home, LogOut, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import SchoolLogo from '../../../components/common/SchoolLogo';
import { useParentPortalStore } from '../useParentPortalStore';

const navItems = [
  { to: '/dashboard', label: 'Tổng quan', icon: Home },
  { to: '/results', label: 'Kết quả', icon: GraduationCap },
  { to: '/assignments', label: 'Bài tập', icon: BookOpen },
  { to: '/certificates', label: 'Chứng nhận', icon: Award },
  { to: '/profile', label: 'Cá nhân', icon: UserRound },
] as const;

const Navigation: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => (
  <div className={mobile ? 'grid grid-cols-5 gap-1' : 'space-y-1.5'}>
    {navItems.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `${mobile
          ? 'flex min-h-[58px] flex-col justify-center gap-1 px-1 text-[10px] sm:text-[11px]'
          : 'relative flex min-h-12 flex-row justify-start gap-3 px-3.5 text-sm'} items-center rounded-[14px] font-semibold transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 active:scale-[0.98] ${isActive
            ? mobile
              ? 'bg-[#eff6ff] text-[#1d4ed8]'
              : 'bg-[#eff6ff] text-[#1e3a8a] shadow-[inset_3px_0_0_#2563eb]'
            : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e3a8a]'}`}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    ))}
  </div>
);

const getInitials = (fullName?: string) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'HS';
  return parts.slice(-2).map(part => part[0]?.toUpperCase()).join('');
};

export const ParentPortalLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const session = useParentPortalStore(state => state.session);
  const unreadCount = useParentPortalStore(state => state.unreadCount);
  const logout = useParentPortalStore(state => state.logout);
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8fafc] font-vietnam text-[#0f172a]">
      <div aria-hidden="true" className="pointer-events-none fixed -right-36 top-24 h-80 w-80 rounded-full bg-[#dbeafe]/45 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -left-32 bottom-20 h-72 w-72 rounded-full bg-[#fef3c7]/40 blur-2xl" />

      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#dbe4f0] bg-white shadow-[0_10px_28px_-22px_rgba(30,58,138,0.8)]">
              <SchoolLogo size={32} decorative />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[1.05rem] font-bold tracking-[-0.025em] text-[#1e3a8a]">
                TôHiệu<span className="text-[#d6a900]">Quiz</span>
              </p>
              <p className="truncate text-xs font-semibold text-[#64748b]">Cổng phụ huynh</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-3 rounded-[15px] border border-[#e2e8f0] bg-[#f8fafc] py-1.5 pl-1.5 pr-3 md:flex">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-[#dbeafe] text-xs font-bold text-[#1d4ed8]">
                {session?.avatar
                  ? <img src={session.avatar} alt="" className="h-full w-full object-cover" />
                  : getInitials(session?.fullName)}
              </span>
              <div className="max-w-48 text-left">
                <p className="truncate text-sm font-bold text-[#1e293b]">{session?.fullName}</p>
                <p className="truncate text-xs text-[#64748b]">Học sinh · Lớp {session?.className}</p>
              </div>
            </div>

            <NavLink
              to="/notifications"
              aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
              className={({ isActive }) => `relative inline-flex h-11 w-11 items-center justify-center rounded-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${isActive ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e3a8a]'}`}
            >
              <Bell className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 min-w-5 rounded-full border-2 border-white bg-[#dc2626] px-1 text-center text-[9px] font-bold leading-4 text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-[13px] px-2.5 text-sm font-semibold text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#1e3a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:px-3"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1280px] gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:gap-8 lg:px-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <div className="sticky top-[100px] space-y-4">
            <div className="rounded-[22px] border border-[#e2e8f0] bg-white p-3 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)]">
              <p className="mb-2 px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">Theo dõi học tập</p>
              <Navigation />
            </div>

            <a
              href="mailto:tongminhkhanh@gmail.com?subject=Hỗ trợ Cổng phụ huynh TôHiệuQuiz"
              className="block rounded-[20px] border border-[#bfdbfe] bg-[#eff6ff] p-4 transition-[background-color,border-color,transform] hover:border-[#93c5fd] hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#2563eb] shadow-sm">
                <CircleHelp className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-bold text-[#1e3a8a]">Cần hỗ trợ?</p>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">Liên hệ nhà trường khi cần trợ giúp về tài khoản.</p>
            </a>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-4">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e2e8f0] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-18px_40px_-34px_rgba(15,23,42,0.5)] backdrop-blur-xl lg:hidden" aria-label="Điều hướng Cổng phụ huynh">
        <Navigation mobile />
      </nav>
    </div>
  );
};

export const ParentPortalFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 font-vietnam" role="status">
    <div className="w-full max-w-sm rounded-[24px] border border-[#e2e8f0] bg-white px-8 py-7 text-center shadow-[0_24px_60px_-44px_rgba(30,58,138,0.75)]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-[#dbe4f0] bg-white">
        <SchoolLogo size={36} decorative />
      </span>
      <p className="mt-4 font-bold text-[#1e3a8a]">TôHiệuQuiz · Cổng phụ huynh</p>
      <p className="mt-2 text-sm text-[#64748b]">Đang tải thông tin học tập…</p>
      <div className="mx-auto mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-[#dbeafe]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2563eb] motion-reduce:animate-none" />
      </div>
    </div>
  </div>
);
