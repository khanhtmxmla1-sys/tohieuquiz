import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useClassroomStore } from '../stores/useClassroomStore';

export const useSessionBootstrap = (): boolean => {
  const restoreTeacherSession = useAuthStore((state) => state.restoreSession);
  const restoreStudentSession = useClassroomStore((state) => state.restoreStudentSession);
  const [sessionsReady, setSessionsReady] = useState(false);

  useEffect(() => {
    let active = true;
    setSessionsReady(false);
    Promise.allSettled([
      restoreTeacherSession(),
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
