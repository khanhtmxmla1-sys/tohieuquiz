import { callApi } from './apiAdapter';
interface QuizAccessVerificationResponse {
  valid: boolean;
}

export const verifyQuizAccessCode = async (
  quizId: string,
  rawCode: string,
): Promise<boolean> => {
  const normalizedQuizId = String(quizId || '').trim();
  const accessCode = String(rawCode || '').trim().toUpperCase();
  if (!normalizedQuizId || !/^[A-Z0-9]{1,10}$/.test(accessCode)) return false;

  try {
    const response = await callApi<QuizAccessVerificationResponse>('verify_quiz_access_code', {
      quizId: normalizedQuizId,
      accessCode,
    });
    return response.valid === true;
  } catch (error) {
    const status = error && typeof error === 'object'
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;
    if (status === 400 || status === 403) return false;
    throw error;
  }
};
