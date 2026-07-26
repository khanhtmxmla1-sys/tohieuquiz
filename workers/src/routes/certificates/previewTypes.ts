import type { FieldConfig } from '../../types/certificates';
import type { CertificateNameFont } from '../../../../shared/certificates.contract';

export interface CertificateRenderPreviewRequest {
  template_id?: string;
  class_id?: string;
  quiz_id?: string;
  student_id?: string;
  achievement_prefix?: string;
  date_line?: string;
  student_name_font?: string;
}

export interface PreviewInput {
  templateId: string;
  classId: string;
  studentId: string;
  quizId: string | null;
  achievementPrefix: string | null;
  dateLine: string | null;
  studentNameFont: CertificateNameFont | null;
}

export interface PreviewTemplate {
  id: string;
  school_id: string | null;
  created_by: string;
  bg_image_r2_key: string;
  fields_config: string;
  canvas_width: number;
  canvas_height: number;
}

export interface PreviewContext {
  input: PreviewInput;
  studentName: string;
  quizTitle: string;
  score: number | null;
  template: PreviewTemplate;
  fieldsConfig: FieldConfig[];
}
