import { callApi } from './apiAdapter';

export interface TeacherAiQuotaData {
  username: string;
  role: 'admin' | 'teacher';
  usageDate: string;
  dailyLimit: number | null;
  usedCount: number;
  remaining: number | null;
  canGenerate: boolean;
  unlimited: boolean;
}

interface QuotaApiResponse {
  status: 'success' | 'error';
  message?: string;
  code?: string;
  data?: TeacherAiQuotaData;
}

const ensureQuotaData = (payload: QuotaApiResponse): TeacherAiQuotaData => {
  if (payload.status !== 'success' || !payload.data) {
    throw new Error(payload.message || 'Không thể tải hạn mức AI.');
  }
  return payload.data;
};

export const getTeacherAiQuota = async (_username: string): Promise<TeacherAiQuotaData> => {
  return ensureQuotaData(await callApi<QuotaApiResponse>('get_teacher_ai_quota'));
};

export const consumeTeacherAiQuota = async (_username: string): Promise<TeacherAiQuotaData> => {
  return ensureQuotaData(await callApi<QuotaApiResponse>('consume_teacher_ai_quota'));
};
