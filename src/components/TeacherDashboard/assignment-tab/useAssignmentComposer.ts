import { useEffect, useState } from 'react';
import { useRosterStore } from '../../../stores/useRosterStore';
import { vietnamDateTimeLocalToIso } from '../../../utils/dateTime';
import type { CreateAssignmentSectionProps } from './types';
import { useAssignmentDraftHydration } from './useAssignmentDraftHydration';
import { useAssignmentFormState } from './useAssignmentFormState';
import { useAssignmentInsightModel } from './useAssignmentInsightModel';

export const useAssignmentComposer = (props: CreateAssignmentSectionProps) => {
  const form = useAssignmentFormState(props.initialQuizId);
  const [showSuccess, setShowSuccess] = useState(false);
  const students = useRosterStore(state => state.students);
  const fetchStudents = useRosterStore(state => state.fetchStudents);
  const draft = useAssignmentDraftHydration({
    draft: props.draft,
    classes: props.classes,
    quizzes: props.quizzes,
    students,
    selectedClassId: form.selectedClassId,
    setSelectedQuizId: form.setSelectedQuizId,
    setSelectedClassId: form.setSelectedClassId,
    setSelectedStudentId: form.setSelectedStudentId,
    setDeadline: form.setDeadline,
    setMaxAttempts: form.setMaxAttempts,
    resetForm: form.resetForm,
    onClearDraft: props.onClearDraft,
  });

  useEffect(() => {
    if (props.initialQuizId) form.setSelectedQuizId(props.initialQuizId);
  }, [props.initialQuizId]);

  useEffect(() => {
    if (!form.selectedClassId) {
      if (!draft.isHydratingDraftRef.current) form.setSelectedStudentId('');
      return;
    }
    fetchStudents(form.selectedClassId);
    if (draft.isHydratingDraftRef.current) {
      draft.isHydratingDraftRef.current = false;
      return;
    }
    form.setSelectedStudentId('');
  }, [form.selectedClassId]);

  const selectedQuiz = props.quizzes.find(quiz => quiz.id === form.selectedQuizId);
  const insight = useAssignmentInsightModel({
    activeDraft: draft.activeDraft,
    quizzes: props.quizzes,
    selectedQuizId: form.selectedQuizId,
    selectedClassId: form.selectedClassId,
    selectedStudentId: form.selectedStudentId,
    draftWarnings: draft.draftWarnings,
    manualNotice: draft.manualNotice,
  });

  const submit = async () => {
    if (!form.selectedQuizId || !form.selectedClassId || !form.deadline) return;
    const success = await props.onCreateAssignment({
      quizId: form.selectedQuizId,
      classId: form.selectedClassId,
      studentId: form.selectedStudentId || undefined,
      deadline: vietnamDateTimeLocalToIso(form.deadline),
      maxAttempts: form.maxAttempts,
    });
    if (!success) return;
    props.onCreated?.();
    form.resetForm();
    draft.setManualNotice(null);
    if (draft.activeDraft) draft.clearDraftState({ keepFormValues: true });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return {
    ...form,
    ...draft,
    showSuccess,
    submit,
    selectedQuiz,
    orderedQuizzes: insight.orderedQuizzes,
    recommendedQuizIds: insight.recommendedQuizIds,
    studentsInClass: students[form.selectedClassId] || [],
    insightModel: insight.insightModel,
  };
};
