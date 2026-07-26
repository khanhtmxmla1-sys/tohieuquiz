import React from 'react';
import { Award, Bell, BookOpen, GraduationCap, Home, LogOut, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { useParentPortalStore } from '../useParentPortalStore';

const navItems = [
  { to: '/dashboard', label: 'Tổng quan', icon: Home },
  { to: '/results', label: 'Kết quả', icon: GraduationCap },
  { to: '/assignments', label: 'Bài tập', icon: BookOpen },
  { to: '/certificates', label: 'Chứng nhận', icon: Award },
  { to: '/profile', label: 'Cá nhân', icon: UserRound },
] as const;

const Navigation: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => (
  <div className={mobile ? 'grid grid-cols-5 gap-1' : 'space-y-1'}>
    {navItems.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) => `${mobile ? 'flex min-h-14 flex-col text-[11px]' : 'flex min-h-11 flex-row text-sm'} items-center justify-center gap-1.5 rounded-xl px-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </NavLink>
    ))}
  </div>
);

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">TôHiệuQuiz</p>
            <p className="font-bold">Cổng phụ huynh</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{session?.fullName}</p>
              <p className="text-xs text-slate-500">Lớp {session?.className}</p>
            </div>
            <NavLink
              to="/notifications"
              aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1200px] gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Navigation />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        <Navigation mobile />
      </nav>
    </div>
  );
};

export const ParentPortalFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
    <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-sm">
      <p className="font-bold text-indigo-700">TôHiệuQuiz · Cổng phụ huynh</p>
      <p className="mt-2 text-sm text-slate-500">Đang tải thông tin…</p>
    </div>
  </div>
);
