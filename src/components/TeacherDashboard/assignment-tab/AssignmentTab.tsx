import AssignmentTrackingSection from '../AssignmentTrackingSection';
import { AssignmentErrorBanner } from './AssignmentErrorBanner';
import { CreateAssignmentSection } from './CreateAssignmentSection';
import { useAssignmentTabData } from './useAssignmentTabData';

const AssignmentTab = () => {
  const data = useAssignmentTabData();
  return (
    <div className="space-y-8">
      <AssignmentErrorBanner
        error={data.classStore.error || data.assignmentStore.error}
        onClear={() => {
          data.classStore.clearError();
          data.assignmentStore.clearError();
        }}
      />
      <CreateAssignmentSection
        classes={data.classStore.classes}
        quizzes={data.quizzes}
        draft={data.draft}
        onClearDraft={data.clearDraft}
        onCreateAssignment={data.createAssignment}
        isLoading={data.classStore.isLoading || data.assignmentStore.isLoading}
      />
      <AssignmentTrackingSection
        assignments={data.assignmentStore.assignments}
        onDelete={data.deleteAssignment}
        onUpdateDeadline={data.updateDeadline}
        onUpdateStatus={data.updateStatus}
        isLoading={data.assignmentStore.isLoading}
      />
    </div>
  );
};

export default AssignmentTab;
