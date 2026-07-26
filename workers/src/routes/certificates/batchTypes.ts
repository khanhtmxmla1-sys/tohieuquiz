import type { CertificateNameFont } from '../../../../shared/certificates.contract';

export interface BatchInput {
  title: string;
  requestId: string;
  classId: string;
  templateId: string;
  quizId: string | null;
  message: string | null;
  achievementPrefix: string | null;
  dateLine: string | null;
  studentNameFont: CertificateNameFont | null;
  studentIds: string[];
}

export interface BatchStudent {
  id: string;
  full_name: string;
}

export interface BatchQuiz {
  id: string;
  title: string;
}

export interface BatchResult {
  score: number | null;
  quiz_title: string | null;
}

export interface BatchScope {
  roster: BatchStudent[];
  quiz: BatchQuiz | null;
  latestResultByName: Map<string, BatchResult>;
}
