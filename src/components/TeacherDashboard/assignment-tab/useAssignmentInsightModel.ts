import { useMemo } from 'react';
import type { Quiz } from '../../../types';
import type { SmartAssignmentWarning } from '../../../types/classroom.types';
import type { AssignmentComposerDraft } from '../../../stores/useTeacherDashboardUIStore';
import type { SmartAssignmentInsightViewModel } from '../SmartAssignmentInsightCard';
import { buildSmartAssignmentInsightModel } from '../buildSmartAssignmentInsightModel';
import { getTagsFallbackMessage, orderAssignmentQuizzes } from './assignmentComposerHelpers';

interface AssignmentInsightOptions {
  activeDraft: AssignmentComposerDraft | null;
  quizzes: Quiz[];
  selectedQuizId: string;
  selectedClassId: string;
  selectedStudentId: string;
  draftWarnings: SmartAssignmentWarning[];
  manualNotice: string | null;
}

export const useAssignmentInsightModel = (options: AssignmentInsightOptions) => {
  const selectedRecommendedQuiz = options.activeDraft?.recommendedQuizzes?.find(
    quiz => quiz.quizId === options.selectedQuizId,
  );
  const orderedQuizzes = useMemo(
    () => orderAssignmentQuizzes(options.quizzes, options.activeDraft?.recommendedQuizzes),
    [options.activeDraft?.recommendedQuizzes, options.quizzes],
  );
  const recommendedQuizIds = useMemo(
    () => new Set((options.activeDraft?.recommendedQuizzes || []).map(quiz => quiz.quizId)),
    [options.activeDraft?.recommendedQuizzes],
  );
  const tagsFallbackMessage = getTagsFallbackMessage(selectedRecommendedQuiz);
  const insightModel = useMemo<SmartAssignmentInsightViewModel | null>(() => (
    buildSmartAssignmentInsightModel({
      activeDraft: options.activeDraft,
      quizzes: options.quizzes,
      selectedQuizId: options.selectedQuizId,
      selectedClassId: options.selectedClassId,
      selectedStudentId: options.selectedStudentId,
      selectedRecommendedQuiz,
      draftWarnings: options.draftWarnings,
      manualNotice: options.manualNotice,
      tagsFallbackMessage,
    })
  ), [
    options.activeDraft,
    options.draftWarnings,
    options.manualNotice,
    options.quizzes,
    options.selectedClassId,
    options.selectedQuizId,
    options.selectedStudentId,
    selectedRecommendedQuiz,
    tagsFallbackMessage,
  ]);

  return { orderedQuizzes, recommendedQuizIds, insightModel };
};
