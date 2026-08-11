export const INTERVENTION_MIN_SAMPLE_SIZE = 3;
export const INTERVENTION_MIN_CONFIDENCE = 0.55;
export const INTERVENTION_MAX_NOTE_LENGTH = 2_000;

export type InterventionGroupStatus = 'ACTIVE' | 'ARCHIVED';
export type InterventionAuditAction =
  | 'GROUP_CREATED'
  | 'NOTE_CREATED'
  | 'ASSIGNMENT_BATCH_CREATED';

export interface InterventionTrendPoint {
  weekStart: string;
  averageScore: number | null;
  attemptCount: number;
}

export interface InterventionStudentSignal {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  latestResultId: string;
  latestSubmittedAt: string;
  firstAttemptScore: number;
  latestAttemptScore: number;
  scoreDelta: number;
  attemptCount: number;
  skillAccuracy: number;
  skillSampleSize: number;
  confidence: number;
  fourWeekTrend: InterventionTrendPoint[];
}

export interface InterventionQuizRecommendation {
  quizId: string;
  title: string;
  questionCount: number;
  matchedQuestionCount: number;
  confidence: number;
}

export interface InterventionSuggestion {
  key: string;
  title: string;
  classId: string;
  className: string;
  subject: string;
  subjectLabel: string;
  skillCode: string;
  skillLabel: string;
  sampleSize: number;
  confidence: number;
  studentCount: number;
  averageFirstScore: number;
  averageLatestScore: number;
  averageScoreDelta: number;
  students: InterventionStudentSignal[];
  recommendedQuizzes: InterventionQuizRecommendation[];
}

export interface InterventionPrivateNote {
  id: string;
  groupId: string;
  studentId: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionGroup {
  id: string;
  name: string;
  status: InterventionGroupStatus;
  classId: string;
  className: string;
  subject: string;
  subjectLabel: string;
  skillCode: string;
  skillLabel: string;
  sampleSize: number;
  confidence: number;
  recommendedQuizzes: InterventionQuizRecommendation[];
  members: InterventionStudentSignal[];
  notes: InterventionPrivateNote[];
  createdAt: string;
  updatedAt: string;
}

export interface InterventionDataReadiness {
  studentsInScope: number;
  resultsInWindow: number;
  quizzesInScope: number;
  questionsInScope: number;
  questionsWithSkillMetadata: number;
  skillMetadataCoveragePercent: number;
  studentSkillSignals: number;
  eligibleSignals: number;
  excludedSignals: {
    stable: number;
    insufficientSamples: number;
    lowConfidence: number;
    missingMetadata: number;
  };
}

export interface InterventionDashboard {
  generatedAt: string;
  criteria: {
    windowDays: 28;
    minimumSampleSize: number;
    minimumConfidence: number;
  };
  readiness: InterventionDataReadiness;
  suggestions: InterventionSuggestion[];
  groups: InterventionGroup[];
}

export interface CreateInterventionGroupRequest {
  suggestionKey: string;
  name?: string;
  className?: string;
  quizId?: string;
  studentIds?: string[];
}

export interface AddInterventionNoteRequest {
  note: string;
  studentId?: string;
}

export interface CreateInterventionAssignmentsRequest {
  quizId: string;
  deadline: string;
  maxAttempts: number;
  idempotencyKey: string;
}

export interface CreateInterventionAssignmentsResponse {
  groupId: string;
  assignmentIds: string[];
  skippedAssignmentIds: string[];
  replayed: boolean;
}

export const buildInterventionSuggestionKey = (
  classId: string,
  subject: string,
  skillCode: string,
): string => `${classId}:${subject}:${skillCode}`;

export const isInterventionSignalEligible = (
  sampleSize: number,
  confidence: number,
): boolean => sampleSize >= INTERVENTION_MIN_SAMPLE_SIZE
  && confidence >= INTERVENTION_MIN_CONFIDENCE;
