import { useEffect } from 'react';
import { useAuthStore } from '../../../../stores/authStore';
import { useQuizStore } from '../../../../stores/quizStore';
import { useAssignmentStore } from '../../../stores/useAssignmentStore';
import { useClassStore } from '../../../stores/useClassStore';
import { useTeacherDashboardUIStore } from '../../../stores/useTeacherDashboardUIStore';
import { showConfirm } from '../../../utils/toast';

export const useAssignmentTabData = () => {
  const authStore = useAuthStore();
  const classStore = useClassStore();
  const assignmentStore = useAssignmentStore();
  const quizStore = useQuizStore();
  const draft = useTeacherDashboardUIStore(state => state.assignmentComposerDraft);
  const clearDraft = useTeacherDashboardUIStore(state => state.clearAssignmentComposerDraft);

  const refreshAssignments = async () => {
    if (!authStore.username) return;
    if (authStore.isAdmin) {
      await assignmentStore.fetchAllAssignments();
      return;
    }
    await assignmentStore.fetchTeacherAssignments(authStore.username);
  };

  useEffect(() => {
    if (!authStore.username) return;
    if (authStore.isAdmin) {
      classStore.fetchClasses();
      assignmentStore.fetchAllAssignments();
      return;
    }
    classStore.fetchClasses(authStore.username);
    assignmentStore.fetchTeacherAssignments(authStore.username);
  }, [authStore.username, authStore.isAdmin]);

  const createAssignment = async (payload: Parameters<typeof assignmentStore.addAssignment>[0]) => {
    const result = await assignmentStore.addAssignment(payload);
    if (result) await refreshAssignments();
    return Boolean(result);
  };
  const deleteAssignment = (id: string) => showConfirm({
    message: 'Xoa bai giao nay?',
    confirmLabel: 'Xoa',
    destructive: true,
    onConfirm: async () => {
      if (await assignmentStore.removeAssignment(id)) await refreshAssignments();
    },
  });
  const updateDeadline = async (id: string, deadline: string) => {
    const ok = await assignmentStore.updateAssignmentDeadline(id, deadline);
    if (ok) await refreshAssignments();
    return ok;
  };
  const updateStatus = async (id: string, status: 'OPEN' | 'CLOSED') => {
    const ok = await assignmentStore.updateAssignmentStatus(id, status);
    if (ok) await refreshAssignments();
    return ok;
  };

  return {
    authStore,
    classStore,
    assignmentStore,
    quizzes: quizStore.quizzes,
    draft,
    clearDraft,
    createAssignment,
    deleteAssignment,
    updateDeadline,
    updateStatus,
  };
};
