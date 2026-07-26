export const RESULT_REPORT_ATTEMPT_POLICIES = ['latest', 'highest', 'first'] as const;
export type ResultReportAttemptPolicy = typeof RESULT_REPORT_ATTEMPT_POLICIES[number];

export const RESULT_REPORT_STUDENT_STATUSES = [
  'not_requested', 'pending', 'sent', 'viewed', 'failed', 'unresolved',
] as const;
export type ResultReportStudentStatus = typeof RESULT_REPORT_STUDENT_STATUSES[number];

export const RESULT_REPORT_PARENT_STATUSES = [
  'not_requested', 'link_created', 'opened', 'revoked', 'failed',
] as const;
export type ResultReportParentStatus = typeof RESULT_REPORT_PARENT_STATUSES[number];

export const RESULT_REPORT_BATCH_STATUSES = [
  'draft', 'sending', 'completed', 'partial_failed',
] as const;
export type ResultReportBatchStatus = typeof RESULT_REPORT_BATCH_STATUSES[number];

export interface ResultReportApiError {
  error: { code: string; message: string };
}

export interface ResultReportApiSuccess<T> {
  data: T;
}

export interface ResultReportStudentIdentity {
  id: string;
  fullName: string;
  username: string;
  parentPhone: string | null;
}

export interface ResultReportRepresentativeResult {
  id: string;
  studentName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
  quizTitle: string;
}

export interface ResultReportCohortReadyItem {
  student: ResultReportStudentIdentity;
  result: ResultReportRepresentativeResult;
  attemptCount: number;
}

export interface ResultReportCohortUnresolvedItem {
  student: ResultReportStudentIdentity;
  reason: 'duplicate_name' | 'result_not_mapped';
}

export interface ResultReportCohortRequest {
  classId: string;
  quizId: string;
  attemptPolicy: ResultReportAttemptPolicy;
}

export interface ResultReportCohortResponse {
  class: { id: string; name: string };
  quiz: { id: string; title: string };
  attemptPolicy: ResultReportAttemptPolicy;
  summary: {
    totalStudents: number;
    completedStudents: number;
    notCompletedStudents: number;
    unresolvedStudents: number;
    reportCount: number;
  };
  ready: ResultReportCohortReadyItem[];
  notCompleted: ResultReportStudentIdentity[];
  unresolved: ResultReportCohortUnresolvedItem[];
}

export interface ResultReportDraftInput {
  resultId: string;
  style: 'nhe_nhang' | 'nghiem_tuc' | 'vui_ve';
  commentMode?: 'ai' | 'manual';
  comment: string;
  needsImprovement: string;
  encouragement: string;
}

export interface CreateResultReportBatchRequest {
  requestId: string;
  classId: string;
  quizId: string;
  attemptPolicy: ResultReportAttemptPolicy;
  drafts: ResultReportDraftInput[];
  notifyStudents: boolean;
  createParentLinks: boolean;
  expiresInDays?: number;
}

export interface ResultReportDeliveryItem {
  id: string;
  batchId: string;
  resultId: string;
  phieuId: string | null;
  studentId: string | null;
  studentName: string;
  parentPhone: string | null;
  notificationId: string | null;
  publicLinkId: string | null;
  publicUrl: string | null;
  studentStatus: ResultReportStudentStatus;
  parentStatus: ResultReportParentStatus;
  attemptCount: number;
  lastError: string | null;
  score: number;
  submittedAt: string;
}

export interface ResultReportBatchSummary {
  id: string;
  requestId: string | null;
  classId: string;
  className: string;
  quizId: string;
  quizTitle: string;
  attemptPolicy: ResultReportAttemptPolicy;
  notifyStudents: boolean;
  createParentLinks: boolean;
  deliveryStatus: ResultReportBatchStatus;
  createdAt: string;
  updatedAt: string;
  counts: {
    total: number;
    studentSent: number;
    studentViewed: number;
    parentLinks: number;
    parentOpened: number;
    failed: number;
  };
}

export interface ResultReportBatchDetail {
  batch: ResultReportBatchSummary;
  items: ResultReportDeliveryItem[];
}

export interface CreateResultReportBatchResult {
  batchId: string;
  status: ResultReportBatchStatus;
}

export interface ResultReportRetryRequest {
  itemIds?: string[];
}

export interface ResultReportRevokeRequest {
  itemIds?: string[];
}

export interface StudentResultReportSummary {
  id: string;
  resultId: string;
  quizId: string;
  quizTitle: string;
  teacherName: string;
  score: number;
  classification: string;
  submittedAt: string;
  publishedAt: string;
}

export interface StudentResultReportDetail extends StudentResultReportSummary {
  studentName: string;
  classId: string;
  subject: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  comment: string;
  needsImprovement: string;
  encouragement: string;
}

export const isResultReportAttemptPolicy = (value: unknown): value is ResultReportAttemptPolicy =>
  typeof value === 'string'
  && RESULT_REPORT_ATTEMPT_POLICIES.includes(value as ResultReportAttemptPolicy);
