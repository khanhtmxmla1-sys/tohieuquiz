import type {
  CertificateNameFont,
  CreateCertificateBatchRequest,
  CreateCertificateBatchResult,
} from '../../../../shared/certificates.contract';

export interface BatchCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
  createBatch: (payload: CreateCertificateBatchRequest) => Promise<CreateCertificateBatchResult>;
}

export interface ClassOption { id: string; name: string }
export interface StudentOption { id: string; fullName: string; username: string }
export interface QuizOption { id: string; title: string }
export interface ResultRecord {
  'Student Name': string;
  'Score': number;
  'Quiz ID': string;
  'Quiz Title': string;
}

export interface BatchStudentRow extends StudentOption {
  score: number | null;
  quizTitle: string | null;
}

export interface CertificatePreviewInput {
  templateId: string;
  classId: string;
  quizId: string;
  studentId: string;
  achievementPrefix: string;
  dateLine: string;
  studentNameFont: CertificateNameFont;
}
