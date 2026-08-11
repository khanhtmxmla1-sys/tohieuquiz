import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { certificateError } from './responses';
import type { BatchInput, BatchQuiz, BatchResult } from './batchTypes';

export async function loadBatchQuizScope(
  env: Env,
  user: JWTPayload,
  input: BatchInput,
): Promise<Response | { quiz: BatchQuiz | null; latestResultByStudentId: Map<string, BatchResult> }> {
  if (!input.quizId) {
    return { quiz: null, latestResultByStudentId: new Map() };
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
    SELECT student_id, score, quiz_title FROM results
    WHERE quiz_id = ? AND class_id = ? AND student_id IS NOT NULL
      AND answers != '{"status":"STARTED"}'
    ORDER BY submitted_at DESC
  `).bind(quiz.id, input.classId).all<{
    student_id: string;
    score: number | null;
    quiz_title: string | null;
  }>();
  const latestResultByStudentId = new Map<string, BatchResult>();
  for (const result of results) {
    const key = String(result.student_id || '');
    if (key && !latestResultByStudentId.has(key)) latestResultByStudentId.set(key, result);
  }
  return { quiz, latestResultByStudentId };
}
