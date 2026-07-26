import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { normalizeLookupText } from './normalize';
import { certificateError } from './responses';
import type { BatchInput, BatchQuiz, BatchResult } from './batchTypes';

export async function loadBatchQuizScope(
  env: Env,
  user: JWTPayload,
  input: BatchInput,
  className: string,
): Promise<Response | { quiz: BatchQuiz | null; latestResultByName: Map<string, BatchResult> }> {
  if (!input.quizId) {
    return { quiz: null, latestResultByName: new Map() };
  }
  const quiz = await env.DB.prepare('SELECT id, title FROM quizzes WHERE id = ?')
    .bind(input.quizId).first<BatchQuiz>();
  if (!quiz) return certificateError('CERTIFICATE_QUIZ_NOT_FOUND', 'Quiz not found', 404);
  if (user.role !== 'admin') {
    const access = await env.DB.prepare(`
      SELECT q.id FROM quizzes q WHERE q.id = ? AND (
        q.created_by = ? OR EXISTS (
          SELECT 1 FROM assignments a WHERE a.quiz_id = q.id AND a.class_id = ?
        )
      )
    `).bind(input.quizId, user.username, input.classId).first();
    if (!access) return certificateError('CERTIFICATE_QUIZ_FORBIDDEN', 'Quiz is outside your scope', 403);
  }
  const { results } = await env.DB.prepare(`
    SELECT student_name, score, quiz_title FROM results
    WHERE quiz_id = ? AND class_name = ? AND answers != '{"status":"STARTED"}'
    ORDER BY submitted_at DESC
  `).bind(quiz.id, className).all<{
    student_name: string;
    score: number | null;
    quiz_title: string | null;
  }>();
  const latestResultByName = new Map<string, BatchResult>();
  for (const result of results) {
    const key = normalizeLookupText(result.student_name);
    if (!latestResultByName.has(key)) latestResultByName.set(key, result);
  }
  return { quiz, latestResultByName };
}
