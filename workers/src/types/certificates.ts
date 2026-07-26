import type {
  CertificateBatchStatus,
  CertificateNameFont,
  CertificateStatus,
} from '../../../shared/certificates.contract';

export type {
  CertificateApiError,
  CertificateApiSuccess,
  CertificateBatchStatus,
  CertificateBatchSummary,
  CertificateStatus,
  CreateCertificateBatchRequest,
  CreateCertificateBatchResult,
  StudentCertificateItem,
} from '../../../shared/certificates.contract';

export interface FieldConfig {
  key: 'student_name' | 'score' | 'quiz_title' | 'date' | 'teacher_name' | 'custom_note' | 'static_text';
  text?: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  fontFamily?: 'Roboto' | 'Spectral' | CertificateNameFont;
  fontStyle?: 'normal' | 'italic';
  baseline?: 'middle' | 'alphabetic';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  prefix?: string;
  suffix?: string;
  format?: 'vi-long-date';
}

export interface CertificateTemplate {
  id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  bg_image_r2_key: string;
  thumbnail_r2_key: string | null;
  fields_config: string;
  is_active: number;
  is_default: number;
  canvas_width: number;
  canvas_height: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CertificateBatch {
  id: string;
  teacher_id: string;
  request_id: string;
  class_id: string | null;
  quiz_id: string | null;
  template_id: string;
  title: string;
  message: string | null;
  status: CertificateBatchStatus;
  attempt_count: number;
  processing_started_at: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  batch_id: string;
  student_id: string;
  student_name: string;
  student_score: number | null;
  quiz_title: string | null;
  image_url: string | null;
  png_r2_key: string | null;
  status: CertificateStatus;
  attempt_count: number;
  error_message: string | null;
  issued_at: string;
  sent_at: string | null;
  updated_at: string;
}
