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

async function fetchAllCursorPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const response = await fetch(`${apiBase()}${path}${separator}limit=100${cursorQuery}`, {
      headers: authHeaders(),
      credentials: 'include',
    });
    const payload = await response.json() as {
      data?: T[];
      meta?: { nextCursor?: string | null; hasMore?: boolean };
    };
    items.push(...(payload.data ?? []));
    cursor = payload.meta?.nextCursor || undefined;
    if (!cursor || payload.meta?.hasMore === false) break;
  }
  return items;
}

export const fetchClassStudents = async (classId: string): Promise<StudentOption[]> =>
  fetchAllCursorPages<StudentOption>(`/api/students?classId=${encodeURIComponent(classId)}`);

export const fetchQuizResults = async (quizId: string): Promise<ResultRecord[]> =>
  fetchAllCursorPages<ResultRecord>(`/api/results?quizId=${encodeURIComponent(quizId)}`);

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
