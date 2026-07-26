import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ParentPortalFallback, ParentPortalLayout } from './layout/ParentPortalLayout';
import ParentActivatePage from './pages/ParentActivatePage';
import ParentAssignmentsPage from './pages/ParentAssignmentsPage';
import ParentCertificatesPage from './pages/ParentCertificatesPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import ParentLoginPage from './pages/ParentLoginPage';
import ParentNotificationsPage from './pages/ParentNotificationsPage';
import ParentProfilePage from './pages/ParentProfilePage';
import ParentResultDetailPage from './pages/ParentResultDetailPage';
import ParentResultsPage from './pages/ParentResultsPage';
import { useParentPortalStore } from './useParentPortalStore';

const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const session = useParentPortalStore(state => state.session);
  return session ? <>{children}</> : <Navigate to="/login" replace />;
};

const ProtectedPage: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ProtectedRoute><ParentPortalLayout>{children}</ParentPortalLayout></ProtectedRoute>
);

const setMetaContent = (name: string, content: string): (() => void) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const existed = Boolean(element);
  const previous = element?.getAttribute('content') ?? null;
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
  return () => {
    if (!element) return;
    if (!existed) element.remove();
    else if (previous === null) element.removeAttribute('content');
    else element.setAttribute('content', previous);
  };
};

export default function ParentPortalApp() {
  const restoreSession = useParentPortalStore(state => state.restoreSession);
  const session = useParentPortalStore(state => state.session);
  const [restoreComplete, setRestoreComplete] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const restoreRobots = setMetaContent('robots', 'noindex,nofollow');
    const restoreReferrer = setMetaContent('referrer', 'no-referrer');
    document.title = 'Cổng phụ huynh - TôHiệuQuiz';
    return () => {
      restoreRobots();
      restoreReferrer();
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void restoreSession().finally(() => {
      if (active) setRestoreComplete(true);
    });
    return () => { active = false; };
  }, [restoreSession]);

  if (!restoreComplete) return <ParentPortalFallback />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      <Route path="/activate" element={<ParentActivatePage />} />
      <Route path="/login" element={<ParentLoginPage />} />
      <Route path="/dashboard" element={<ProtectedPage><ParentDashboardPage /></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage><ParentNotificationsPage /></ProtectedPage>} />
      <Route path="/results" element={<ProtectedPage><ParentResultsPage /></ProtectedPage>} />
      <Route path="/results/:resultId" element={<ProtectedPage><ParentResultDetailPage /></ProtectedPage>} />
      <Route path="/assignments" element={<ProtectedPage><ParentAssignmentsPage /></ProtectedPage>} />
      <Route path="/certificates" element={<ProtectedPage><ParentCertificatesPage /></ProtectedPage>} />
      <Route path="/profile" element={<ProtectedPage><ParentProfilePage /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
