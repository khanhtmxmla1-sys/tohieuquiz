import { useEffect, useRef, useState } from 'react';
import { toVietnamDateTimeLocal } from '../../../utils/dateTime';
import type { Classroom, SmartAssignmentWarning } from '../../../types/classroom.types';
import type { Quiz } from '../../../types';
import type { AssignmentComposerDraft } from '../../../stores/useTeacherDashboardUIStore';

interface DraftHydrationOptions {
  draft: AssignmentComposerDraft | null;
  classes: Classroom[];
  quizzes: Quiz[];
  students: Record<string, Array<{ id: string }>>;
  selectedClassId: string;
  setSelectedQuizId: (value: string) => void;
  setSelectedClassId: (value: string) => void;
  setSelectedStudentId: (value: string) => void;
  setDeadline: (value: string) => void;
  setMaxAttempts: (value: number) => void;
  resetForm: () => void;
  onClearDraft: () => void;
}

export const useAssignmentDraftHydration = (options: DraftHydrationOptions) => {
  const [activeDraft, setActiveDraft] = useState<AssignmentComposerDraft | null>(null);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [draftWarnings, setDraftWarnings] = useState<SmartAssignmentWarning[]>([]);
  const lastHydratedDraftRef = useRef<string | null>(null);
  const isHydratingDraftRef = useRef(false);

  const appendDraftWarning = (warning: SmartAssignmentWarning) => setDraftWarnings(current => (
    current.some(item => item.code === warning.code && item.message === warning.message)
      ? current
      : [...current, warning]
  ));
  const clearDraftState = (settings?: { keepFormValues?: boolean; manualNotice?: string }) => {
    setActiveDraft(null);
    setDraftWarnings([]);
    options.onClearDraft();
    if (settings?.manualNotice) setManualNotice(settings.manualNotice);
    if (!settings?.keepFormValues) options.resetForm();
  };

  useEffect(() => {
    if (!options.draft || lastHydratedDraftRef.current === options.draft.createdAt) return;
    isHydratingDraftRef.current = true;
    lastHydratedDraftRef.current = options.draft.createdAt;
    setManualNotice(null);
    setActiveDraft(options.draft);
    setDraftWarnings(options.draft.warnings || []);
    options.setSelectedQuizId(options.draft.quizId);
    options.setSelectedClassId(options.draft.classId);
    options.setSelectedStudentId(options.draft.studentId || '');
    options.setDeadline(toVietnamDateTimeLocal(options.draft.deadline));
    options.setMaxAttempts(options.draft.maxAttempts);
  }, [options.draft]);

  useEffect(() => {
    if (!activeDraft) return;
    if (options.quizzes.length > 0 && !options.quizzes.some(quiz => quiz.id === activeDraft.quizId)) {
      options.setSelectedQuizId('');
      appendDraftWarning({
        code: 'QUIZ_NOT_FOUND',
        message: 'De goi y khong con ton tai. Thay co vui long chon mot de khac.',
      });
    }
    if (options.classes.length > 0 && !options.classes.some(item => item.id === activeDraft.classId)) {
      options.setSelectedClassId('');
      options.setSelectedStudentId('');
      clearDraftState({
        keepFormValues: true,
        manualNotice: 'Khong tim thay lop tu goi y nay. He thong da quay ve che do giao bai thu cong.',
      });
    }
  }, [activeDraft, options.classes, options.quizzes]);

  useEffect(() => {
    if (!activeDraft?.studentId || options.selectedClassId !== activeDraft.classId) return;
    if (!options.students[activeDraft.classId]) return;
    const hasStudent = options.students[activeDraft.classId].some(student => student.id === activeDraft.studentId);
    if (!hasStudent) {
      options.setSelectedStudentId('');
      clearDraftState({
        keepFormValues: true,
        manualNotice: 'Khong tim thay hoc sinh trong lop nay nua. He thong da giu lai de va lop de thay co giao thu cong.',
      });
    }
  }, [activeDraft, options.selectedClassId, options.students]);

  return {
    activeDraft,
    manualNotice,
    setManualNotice,
    draftWarnings,
    clearDraftState,
    isHydratingDraftRef,
  };
};
