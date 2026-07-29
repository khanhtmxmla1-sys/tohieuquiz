export const PARENT_NOTIFICATION_KINDS = [
  'quiz_result',
  'result_report',
  'homework_assigned',
  'homework_due',
  'homework_graded',
  'class_announcement',
  'certificate_issued',
] as const;

export type ParentNotificationKind = typeof PARENT_NOTIFICATION_KINDS[number];

export interface ParentApiSuccess<T> {
  data: T;
}

export interface ParentApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ParentStudentProfile {
  id: string;
  fullName: string;
  className: string;
  avatar: string;
}

export interface ParentNotificationItem {
  id: string;
  kind: ParentNotificationKind;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  isImportant: boolean;
  isRead: boolean;
  publishedAt: string;
  expiresAt: string | null;
}

export interface ParentResultHistoryItem {
  id: string;
  quizId: string;
  title: string;
  subject: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  correctRate: number;
  classification: string | null;
  hasTeacherReport: boolean;
  comment: string | null;
  needsImprovement: string | null;
  encouragement: string | null;
  submittedAt: string;
}

export interface ParentHomeworkHistoryItem {
  id: string;
  assignmentId: string;
  title: string;
  subject: string;
  deadline: string;
  status: 'pending' | 'submitted' | 'graded' | 'overdue';
  score: number | null;
  teacherFeedback: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
}

export interface ParentCertificateHistoryItem {
  id: string;
  batchId: string;
  title: string;
  teacherName: string;
  message: string | null;
  quizTitle: string | null;
  studentScore: number | null;
  imageUrl: string | null;
  issuedAt: string;
  sentAt: string | null;
  status: 'sent' | 'revoked';
}

export interface ParentHistoryPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const PARENT_DIGEST_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type ParentDigestWeekday = typeof PARENT_DIGEST_WEEKDAYS[number];

export interface ParentContactPreferences {
  email: string | null;
  emailVerifiedAt: string | null;
  weeklyDigestEnabled: boolean;
  digestWeekday: ParentDigestWeekday;
  digestHour: number;
  timezone: 'Asia/Ho_Chi_Minh';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailKinds: ParentNotificationKind[];
  emailRolloutReady: boolean;
  updatedAt: string | null;
}

export interface ParentContactPreferencesInput {
  email: string | null;
  weeklyDigestEnabled: boolean;
  digestWeekday: ParentDigestWeekday;
  digestHour: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  emailKinds: ParentNotificationKind[];
}

export interface ParentDigestSnapshot {
  weekStart: string;
  weekEnd: string;
  completedQuizzes: number;
  averageScore: number;
  pendingAssignments: number;
  supportAreas: Array<{
    subject: string;
    correctRate: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
  homeSuggestions: string[];
}

export interface ParentDashboardPayload {
  student: ParentStudentProfile;
  period: {
    weekStart: string;
    weekEnd: string;
    previousWeekStart: string;
  };
  metrics: {
    completedQuizzes: number;
    averageScore: number;
    learningSeconds: number;
    correctRate: number;
    pendingAssignments: number;
    unreadNotifications: number;
  };
  comparison: {
    averageScoreDelta: number;
    completedQuizzesDelta: number;
  };
  subjects: Array<{
    subject: string;
    averageScore: number;
    correctRate: number;
    questionCount: number;
    confidence: 'low' | 'medium' | 'high';
  }>;
  recentActivity: Array<{
    id: string;
    type: 'quiz' | 'homework';
    title: string;
    subject: string;
    score: number | null;
    occurredAt: string;
  }>;
  recommendations: string[];
  importantNotifications: ParentNotificationItem[];
}
