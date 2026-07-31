import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useClassroomStore } from '../stores/useClassroomStore';

export const useSessionBootstrap = (): boolean => {
  const location = useLocation();
  const restoreTeacherSession = useAuthStore((state) => state.restoreSession);
  const restoreStudentSession = useClassroomStore((state) => state.restoreStudentSession);
  // Session recovery belongs to app bootstrap, not client-side route changes.
  const initialPathnameRef = useRef(location.pathname);
  const [sessionsReady, setSessionsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const forceTeacherRestore = initialPathnameRef.current === '/teacher'
      || initialPathnameRef.current.startsWith('/teacher/');
    Promise.allSettled([
      restoreTeacherSession(forceTeacherRestore),
      restoreStudentSession(),
    ]).finally(() => {
      if (active) setSessionsReady(true);
    });
    return () => {
      active = false;
    };
  }, [restoreTeacherSession, restoreStudentSession]);

  return sessionsReady;
};
