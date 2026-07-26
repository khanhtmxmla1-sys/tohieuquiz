import { useAuthStore } from '../../../../stores/authStore';
import { useQuizStore } from '../../../../stores/quizStore';
import { useClassroomStore } from '../../../stores/useClassroomStore';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export const useTeacherLogout = (
  setActiveTab: (tab: TeacherDashboardTab) => void,
  clearAssignmentComposerDraft: () => void,
) => {
  const authStore = useAuthStore();
  const quizStore = useQuizStore();
  return () => {
    clearAssignmentComposerDraft();
    setActiveTab('overview');
    authStore.logout();
    useClassroomStore.getState().logoutStudent();
    quizStore.setView('home');
  };
};
