import type { CreateAssignmentSectionProps } from './types';
import { useAssignmentComposer } from './useAssignmentComposer';
import { AssignmentComposerHeader } from './AssignmentComposerHeader';
import { AssignmentInsight } from './AssignmentInsight';
import { AssignmentQuizField } from './AssignmentQuizField';
import { AssignmentAudienceFields } from './AssignmentAudienceFields';
import { AssignmentScheduleFields } from './AssignmentScheduleFields';
import { SelectedQuizPreview } from './SelectedQuizPreview';
import { AssignmentSubmitRow } from './AssignmentSubmitRow';

export const CreateAssignmentSection = (props: CreateAssignmentSectionProps) => {
  const composer = useAssignmentComposer(props);
  const isDrawer = props.variant === 'drawer';
  return (
    <div className={isDrawer ? 'space-y-5' : 'bg-white rounded-2xl border border-gray-100 p-6 shadow-sm'}>
      {!isDrawer && <AssignmentComposerHeader />}
      {!isDrawer && (
        <AssignmentInsight
          manualNotice={composer.manualNotice}
          model={composer.insightModel}
          onClearDraft={() => composer.clearDraftState({ keepFormValues: true })}
        />
      )}
      {isDrawer && <SelectedQuizPreview quiz={composer.selectedQuiz} />}
      <div className={isDrawer ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-5 gap-4 mb-5'}>
        {!props.initialQuizId && (
          <AssignmentQuizField
            selectedQuizId={composer.selectedQuizId}
            setSelectedQuizId={composer.setSelectedQuizId}
            quizzes={composer.orderedQuizzes}
            recommendedQuizIds={composer.recommendedQuizIds}
          />
        )}
        <AssignmentAudienceFields
          classes={props.classes}
          selectedClassId={composer.selectedClassId}
          setSelectedClassId={composer.setSelectedClassId}
          selectedStudentId={composer.selectedStudentId}
          setSelectedStudentId={composer.setSelectedStudentId}
          students={composer.studentsInClass}
        />
        <AssignmentScheduleFields
          deadline={composer.deadline}
          setDeadline={composer.setDeadline}
          maxAttempts={composer.maxAttempts}
          setMaxAttempts={composer.setMaxAttempts}
        />
      </div>
      {!isDrawer && <SelectedQuizPreview quiz={composer.selectedQuiz} />}
      <AssignmentSubmitRow
        disabled={!composer.selectedQuizId || !composer.selectedClassId || !composer.deadline}
        isLoading={props.isLoading}
        showSuccess={composer.showSuccess}
        onSubmit={composer.submit}
      />
    </div>
  );
};
