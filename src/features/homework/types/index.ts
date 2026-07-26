/**
 * ítong Homework Types
 * Enterprise level data models for automated grading system
 */

export type AssignmentType = 'PDF' | 'IMAGE' | 'DOCX' | 'MIXED';

export interface HomeworkAssignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  deadline: string;
  class_id: string;
  teacher_id: string;
  file_url: string; // Resource URL
  ai_content: string; // AI generated content/keys
  created_at: string;
  total_students?: number;
  submitted_count?: number;
  class?: { id: string; name: string };
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
  effectiveStatus?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'EXPIRED' | 'ARCHIVED';
  max_attempts?: number;
  maxAttempts?: number;
  gradedCount?: number;
  pendingCount?: number;
  totalStudents?: number;
  submittedCount?: number;
  published_at?: string | null;
  updated_at?: string;
  archived_at?: string | null;
  source_ocr_text?: string;
  rubric_json?: string;
  rubric?: GradingCriterion[];
}

export interface HomeworkSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  status: 'SUBMITTED' | 'AI_REVIEW' | 'GRADED';
  file_urls: string[]; // List of student image URLs
  student_note: string;
  teacher_feedback: string;
  ai_evaluation: string;
  score: number;
  submitted_at: string;
  analyticsData?: AnalyticsNode[];
  attempt_no?: number;
  attemptNo?: number;
  idempotency_key?: string;
  ai_score?: number | null;
  ai_confidence?: number | null;
  ai_feedback?: string;
  gradingBreakdown?: GradingCriterion[];
  graded_by?: string | null;
  graded_at?: string | null;
  published_at?: string | null;
}

export interface GradingCriterion {
  questionId: string;
  label: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface HomeworkAssignmentAnalytics {
  assignmentId: string;
  totalStudents: number;
  submitted: number;
  onTime: number;
  late: number;
  notSubmitted: number;
  graded: number;
  pending: number;
  averageScore: number;
  medianScore: number;
  scoreDistribution: Record<string, number>;
  criteria: Array<{
    questionId: string;
    label: string;
    notMet: number;
    partial: number;
    mastered: number;
    total: number;
    studentsNeedingHelp: string[];
  }>;
  mostMissed: HomeworkAssignmentAnalytics['criteria'];
}

export interface AnalyticsNode {
  questionId: string | number;
  score: number; // 0.0 to 1.0 (0=sai, 1=đúng, 0.5=đúng một nửa)
  label: string; // Tên hiển thị, vd: "Câu 1"
}

export interface HomeworkConfig {
  compressionQuality: number; // 0.1 to 1.0
  maxImageWidth: number;
  aiModel: string;
}
export interface AIResult {
  ocrText: string;
  score: number;
  confidence: number;
  feedback: string;
  criteriaBreakdown: Array<{
    label: string;
    score: number;
    maxScore: number;
    comment: string;
  }>;
  flaggedReason?: string | null;
}
