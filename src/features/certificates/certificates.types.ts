import type { CertificateStatus } from '../../../shared/certificates.contract';

export interface Certificate {
  id: string;
  batchId: string;
  title: string;
  teacherName: string;
  studentScore: number | null;
  quizTitle: string | null;
  pngUrl: string | null; // R2 public URL, null while render is pending/error
  issuedAt: string;     // ISO date string
  renderStatus?: CertificateStatus;
  errorMessage?: string | null;
  isRevoked?: boolean;
}

export interface FieldConfig {
  key: 'student_name' | 'score' | 'quiz_title' | 'date' | 'teacher_name' | 'custom_note' | 'static_text';
  text?: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  fontFamily?: 'Roboto' | 'Spectral' | 'Dancing Script' | 'Great Vibes';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  prefix?: string;
  suffix?: string;
  format?: 'vi-long-date';
}

export interface CertificateTemplate {
  id: string;
  name: string;
  bgImageUrl: string;
  fieldsConfig: FieldConfig[];
  isActive: boolean;
}
