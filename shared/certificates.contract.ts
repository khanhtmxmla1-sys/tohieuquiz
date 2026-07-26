export const CERTIFICATE_BATCH_STATUSES = [
  'pending',
  'processing',
  'sent',
  'partial',
  'failed',
] as const;

export const CERTIFICATE_STATUSES = [
  'pending',
  'processing',
  'sent',
  'failed',
  'revoked',
] as const;

export const CERTIFICATE_NAME_FONTS = [
  'Great Vibes',
  'Dancing Script',
  'Playwrite VN',
  'Allura',
  'Alex Brush',
] as const;

export type CertificateBatchStatus = typeof CERTIFICATE_BATCH_STATUSES[number];
export type CertificateStatus = typeof CERTIFICATE_STATUSES[number];
export type CertificateNameFont = typeof CERTIFICATE_NAME_FONTS[number];

export interface CertificateApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface CertificateApiSuccess<T> {
  data: T;
}

export interface CreateCertificateBatchRequest {
  request_id: string;
  template_id: string;
  title: string;
  message?: string;
  achievement_prefix?: string;
  date_line?: string;
  student_name_font?: CertificateNameFont;
  class_id: string;
  quiz_id?: string;
  student_ids: string[];
}

export interface CreateCertificateBatchResult {
  batch_id: string;
  status: CertificateBatchStatus;
}

export interface CertificateBatchSummary {
  id: string;
  title: string;
  message: string | null;
  status: CertificateBatchStatus;
  template_name: string | null;
  total_certificates: number;
  sent_certificates: number;
  failed_certificates: number;
  created_at: string;
  sent_at: string | null;
}

export interface StudentCertificateItem {
  id: string;
  batch_id: string;
  title: string;
  teacher_name: string;
  student_score: number | null;
  quiz_title: string | null;
  image_url: string | null;
  issued_at: string;
  sent_at: string | null;
  status: CertificateStatus;
}

export interface CertificateBatchStudentItem {
  id: string;
  student_id: string;
  student_name: string;
  status: CertificateStatus;
  student_score: number | null;
  quiz_title: string | null;
  image_url: string | null;
  error_message: string | null;
  sent_at: string | null;
}

export interface CertificateBatchDetail {
  batch: CertificateBatchSummary & { error_message?: string | null };
  certificates: CertificateBatchStudentItem[];
}

export interface CertificateNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export function isCertificateBatchStatus(value: unknown): value is CertificateBatchStatus {
  return typeof value === 'string' && CERTIFICATE_BATCH_STATUSES.includes(value as CertificateBatchStatus);
}

export function isCertificateStatus(value: unknown): value is CertificateStatus {
  return typeof value === 'string' && CERTIFICATE_STATUSES.includes(value as CertificateStatus);
}

export function isCertificateNameFont(value: unknown): value is CertificateNameFont {
  return typeof value === 'string' && CERTIFICATE_NAME_FONTS.includes(value as CertificateNameFont);
}
