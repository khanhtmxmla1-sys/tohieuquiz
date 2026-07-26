import { StudentResult } from '../../types';
import { requestWorkerAiText } from './workerAiClient';

/** Generate a privacy-minimized learning analysis through the authenticated Worker. */
export const analyzeStudentPerformance = async (
  result: StudentResult,
  competencyData: Array<{ subject: string; score: number }>,
  _apiKey?: string,
): Promise<string> => {
  const analysisContext = {
    quizTitle: result.quizTitle,
    score: result.score,
    correctCount: result.correctCount,
    totalQuestions: result.totalQuestions,
    timeTaken: result.timeTaken,
    competencies: competencyData.map((item) => ({ name: item.subject, score: item.score })),
  };

  const systemPrompt = `B?n l? gi?o vi?n ti?u h?c gi?u kinh nghi?m.
Vi?t nh?n x?t 100-150 t? b?ng ti?ng Vi?t, ?m ?p v? chuy?n nghi?p.
N?u ?i?m m?nh, v?ng c?n c?i thi?n v? 1-2 h?nh ??ng cho ph? huynh.
Kh?ng ?o?n t?n, gi?i t?nh ho?c th?ng tin c? nh?n c?a h?c sinh.
Ch? d?ng d? li?u ???c cung c?p.`;

  return requestWorkerAiText({
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `K?t qu? h?c t?p ?? ?n danh:\n${JSON.stringify(analysisContext, null, 2)}` },
    ],
    temperature: 0.7,
  });
};
