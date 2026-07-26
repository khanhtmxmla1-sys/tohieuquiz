import type { ResultReportAttemptPolicy } from '../../../../shared/result-reports.contract';

export interface ResultReportCohortInput {
  classId: string;
  quizId: string;
  attemptPolicy: ResultReportAttemptPolicy;
}

export interface ResultReportClassRow {
  id: string;
  name: string;
  teacher_username: string;
}

export interface ResultReportQuizRow {
  id: string;
  title: string;
  category?: string | null;
}

export interface ResultReportRosterDbRow {
  id: string;
  full_name: string;
  username: string;
  parent_phone: string | null;
}

export interface ResultReportSourceDbRow {
  id: string | number;
  student_name: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number | null;
  submitted_at: string;
  quiz_title: string | null;
}

export interface ResultReportCohortScope {
  classroom: ResultReportClassRow;
  quiz: ResultReportQuizRow;
  roster: ResultReportRosterDbRow[];
  results: ResultReportSourceDbRow[];
}
