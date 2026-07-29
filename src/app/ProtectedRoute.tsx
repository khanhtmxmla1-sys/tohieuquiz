import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useClassroomStore } from '../stores/useClassroomStore';
import { buildLoginRedirect } from './navigationRoutes';

interface ProtectedRouteProps {
  role: 'teacher' | 'student';
  sessionsReady: boolean;
  children: ReactNode;
}

export const ProtectedRoute = ({ role, sessionsReady, children }: ProtectedRouteProps) => {
  const location = useLocation();
  const teacherAuthenticated = useAuthStore((state) => state.isLoggedIn);
  const studentAuthenticated = useClassroomStore((state) => Boolean(state.studentSession));

  if (!sessionsReady) {
    return (
      <div
        data-testid="route-session-loading"
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-[#F8F9FB] text-sm font-semibold text-slate-600"
      >
        Đang khôi phục phiên đăng nhập…
      </div>
    );
  }

  const authenticated = role === 'teacher' ? teacherAuthenticated : studentAuthenticated;
  if (!authenticated) {
    return (
      <Navigate
        to={buildLoginRedirect(role, location.pathname, location.search)}
        replace
      />
    );
  }

  return children;
};
