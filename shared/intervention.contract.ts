export const INTERVENTION_MIN_SAMPLE_SIZE = 3;
export const INTERVENTION_MIN_CONFIDENCE = 0.55;
export const INTERVENTION_MAX_NOTE_LENGTH = 2_000;
export const INTERVENTION_DECLINING_SCORE_DELTA_THRESHOLD = -1;
export const INTERVENTION_PERSISTENT_ATTEMPT_THRESHOLD = 5;
export const INTERVENTION_PERSISTENT_ACCURACY_THRESHOLD = 50;
export const INTERVENTION_PROGRESS_MIN_SAMPLE_SIZE = INTERVENTION_MIN_SAMPLE_SIZE;
export const INTERVENTION_PROGRESS_ACCURACY_DELTA_THRESHOLD = 5;

export type InterventionGroupStatus = 'ACTIVE' | 'ARCHIVED';
export type InterventionAuditAction =
  | 'GROUP_CREATED'
  | 'GROUP_ARCHIVED'
  | 'NOTE_CREATED'
  | 'ASSIGNMENT_BATCH_CREATED';

export const INTERVENTION_ARCHIVE_REASONS = [
  'GOAL_REACHED',
  'MOVED_TO_OTHER_SUPPORT',
  'CREATED_BY_MISTAKE',
  'OTHER',
] as const;

export type InterventionArchiveReason = typeof INTERVENTION_ARCHIVE_REASONS[number];

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

export type InterventionSuggestionReason =
  | 'LOW_ACCURACY'
  | 'DECLINING_TREND'
  | 'PERSISTENT_WEAKNESS';

export interface InterventionSuggestionEvidence {
  reason: InterventionSuggestionReason;
  averageSkillAccuracy: number;
  minimumSkillAccuracy: number;
  recentAttemptCount: number;
  improvingStudentCount: number;
  unchangedStudentCount: number;
  decliningStudentCount: number;
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
  evidence: InterventionSuggestionEvidence;
  students: InterventionStudentSignal[];
  recommendedQuizzes: InterventionQuizRecommendation[];
}

export type InterventionProgressStatus =
  | 'NO_ASSIGNMENT'
  | 'WAITING_FOR_RESULTS'
  | 'IMPROVING'
  | 'NEEDS_ATTENTION'
  | 'STABLE';

export interface InterventionMemberProgress {
  studentId: string;
  baselineSkillAccuracy: number;
  currentSkillAccuracy: number | null;
  skillAccuracyDelta: number | null;
  baselineScore: number;
  currentScore: number | null;
  scoreDelta: number | null;
  assignedCount: number;
  completedCount: number;
  postInterventionSampleSize: number;
  lastResultAt: string | null;
  status: InterventionProgressStatus;
}

export interface InterventionGroupProgress {
  status: InterventionProgressStatus;
  assignedCount: number;
  completedCount: number;
  completionPercent: number;
  improvingCount: number;
  needsAttentionCount: number;
  waitingCount: number;
  averageSkillAccuracyDelta: number | null;
  averageScoreDelta: number | null;
  evaluatedAt: string;
  members: InterventionMemberProgress[];
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
  progress: InterventionGroupProgress;
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
  archivedGroups: InterventionGroup[];
}

export interface CreateInterventionGroupRequest {
  suggestionKey: string;
  name?: string;
  className?: string;
  quizId?: string;
  studentIds?: string[];
}

export interface ArchiveInterventionGroupRequest {
  reason: InterventionArchiveReason;
  note?: string;
}

export interface ArchiveInterventionGroupResponse {
  groupId: string;
  status: 'ARCHIVED';
  reason: InterventionArchiveReason;
  note: string | null;
  archivedAt: string;
}

export interface AddInterventionNoteRequest {
  note: string;
  studentId?: string;
}

export interface InterventionAssignmentPreview {
  groupId: string;
  quizId: string;
  memberCount: number;
  openAssignmentCount: number;
  assignableCount: number;
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
