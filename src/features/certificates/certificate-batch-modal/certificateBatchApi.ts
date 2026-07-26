import { getWorkersApiBaseUrl } from '../../../services/api/config';
import type {
  CertificatePreviewInput,
  ClassOption,
  QuizOption,
  ResultRecord,
  StudentOption,
} from './types';

const authHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json' });
const apiBase = () => getWorkersApiBaseUrl();

export const fetchClassOptions = async (): Promise<ClassOption[]> => {
  const response = await fetch(`${apiBase()}/api/classes`, { headers: authHeaders(), credentials: 'include' });
  const payload = await response.json() as { data?: ClassOption[] };
  return payload.data ?? [];
};

export const fetchQuizOptions = async (): Promise<QuizOption[]> => {
  const response = await fetch(`${apiBase()}/api/quizzes`, { headers: authHeaders(), credentials: 'include' });
  const payload = await response.json() as QuizOption[];
  return Array.isArray(payload) ? payload : [];
};

export const fetchClassStudents = async (classId: string): Promise<StudentOption[]> => {
  const response = await fetch(`${apiBase()}/api/students?classId=${classId}`, { headers: authHeaders(), credentials: 'include' });
  const payload = await response.json() as { data?: StudentOption[] };
  return payload.data ?? [];
};

export const fetchQuizResults = async (quizId: string): Promise<ResultRecord[]> => {
  const response = await fetch(`${apiBase()}/api/results?quizId=${quizId}&limit=200`, { headers: authHeaders(), credentials: 'include' });
  const payload = await response.json() as { data?: ResultRecord[] };
  return payload.data ?? [];
};

export const renderCertificatePreview = async (input: CertificatePreviewInput): Promise<Blob> => {
  const response = await fetch(`${apiBase()}/api/certificates/render-preview`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      template_id: input.templateId,
      class_id: input.classId,
      quiz_id: input.quizId || undefined,
      student_id: input.studentId,
      achievement_prefix: input.achievementPrefix.trim(),
      date_line: input.dateLine.trim(),
      student_name_font: input.studentNameFont,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `Không thể tạo ảnh xem trước (${response.status})`);
  }
  return response.blob();
};
