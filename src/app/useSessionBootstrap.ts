import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useClassroomStore } from '../stores/useClassroomStore';

export const useSessionBootstrap = (): boolean => {
  const location = useLocation();
  const restoreTeacherSession = useAuthStore((state) => state.restoreSession);
  const restoreStudentSession = useClassroomStore((state) => state.restoreStudentSession);
  const [sessionsReady, setSessionsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const forceTeacherRestore = location.pathname === '/teacher'
      || location.pathname.startsWith('/teacher/');
    setSessionsReady(false);
    Promise.allSettled([
      restoreTeacherSession(forceTeacherRestore),
      restoreStudentSession(),
    ]).finally(() => {
      if (active) setSessionsReady(true);
    });
    return () => {
      active = false;
    };
  }, [location.pathname, restoreTeacherSession, restoreStudentSession]);

  return sessionsReady;
};
