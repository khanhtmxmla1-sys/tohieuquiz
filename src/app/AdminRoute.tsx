import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';

interface AdminRouteProps {
  children: ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const location = useLocation();

  if (!isAdmin) {
    return (
      <Navigate
        to="/teacher/overview"
        replace
        state={{ deniedPath: location.pathname }}
      />
    );
  }

  return <>{children}</>;
};
