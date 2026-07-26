import type { Classroom, CreateAssignmentPayload, SmartAssignmentWarning } from '../../../types/classroom.types';
import type { Quiz } from '../../../types';
import type { AssignmentComposerDraft } from '../../../stores/useTeacherDashboardUIStore';

export interface CreateAssignmentSectionProps {
  classes: Classroom[];
  quizzes: Quiz[];
  draft: AssignmentComposerDraft | null;
  onClearDraft: () => void;
  onCreateAssignment: (payload: CreateAssignmentPayload) => Promise<boolean>;
  isLoading: boolean;
  initialQuizId?: string;
  variant?: 'page' | 'drawer';
  onCreated?: () => void;
}

export interface ComposerFormState {
  selectedQuizId: string;
  selectedClassId: string;
  selectedStudentId: string;
  deadline: string;
  maxAttempts: number;
}

export interface DraftState {
  activeDraft: AssignmentComposerDraft | null;
  manualNotice: string | null;
  draftWarnings: SmartAssignmentWarning[];
}
