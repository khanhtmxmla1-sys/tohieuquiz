import { requestWorkerAiText } from './ai/workerAiClient';

const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

export interface TrangNguyenSearchResult {
  success: boolean;
  content: string;
  error?: string;
}

export async function searchTrangNguyenQuestions(
  classLevel: string,
  round: string = 'school',
  topic?: string,
): Promise<TrangNguyenSearchResult> {
  const roundVi: Record<string, string> = {
    school: 'v?ng tr??ng', district: 'v?ng huy?n qu?n',
    provincial: 'v?ng t?nh th?nh ph?', national: 'v?ng qu?c gia',
  };
  const topicText = topic ? ` ch? ?? "${topic}"` : '';
  const prompt = `T?m c?c d?ng c?u h?i Tr?ng Nguy?n Ti?ng Vi?t l?p ${classLevel} ${roundVi[round] || round}${topicText}.
T?m t?t 5-8 v? d? c? ?? b?i, l?a ch?n v? ??p ?n. Kh?ng ??a th?ng tin c? nh?n.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const content = await requestWorkerAiText({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'B?n l? chuy?n gia Tr?ng Nguy?n Ti?ng Vi?t ti?u h?c.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }, { timeoutMs: REQUEST_TIMEOUT_MS });
      return { success: true, content };
    } catch (error: unknown) {
      if (attempt === MAX_RETRIES) {
        console.warn('[Trang Nguyen Search] B? qua t?m ki?m sau khi Worker AI th?t b?i.', error);
        return { success: true, content: '' };
      }
    }
  }
  return { success: true, content: '' };
}

export function enrichPromptWithSearchResults(
  basePrompt: string,
  searchResult: TrangNguyenSearchResult,
): string {
  if (!searchResult.success || !searchResult.content) return basePrompt;
  return `${basePrompt}\n\n===== THAM KH?O D?NG ?? =====\n${searchResult.content}\n===== H?T THAM KH?O =====`;
}
