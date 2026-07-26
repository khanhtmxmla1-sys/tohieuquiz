import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { certificateError } from './responses';
import type { PreviewInput } from './previewTypes';

export async function loadPreviewQuiz(
  env: Env,
  user: JWTPayload,
  input: PreviewInput,
  className: string,
  studentName: string,
): Promise<Response | { quizTitle: string; score: number | null }> {
  if (!input.quizId) return { quizTitle: '', score: null };
  const quiz = await env.DB.prepare('SELECT id, title, created_by FROM quizzes WHERE id = ?')
    .bind(input.quizId).first<{ id: string; title: string; created_by: string }>();
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
  const result = await env.DB.prepare(`
    SELECT score, quiz_title FROM results
    WHERE quiz_id = ? AND class_name = ? AND student_name = ?
      AND answers != '{"status":"STARTED"}'
    ORDER BY submitted_at DESC LIMIT 1
  `).bind(input.quizId, className, studentName)
    .first<{ score: number | null; quiz_title: string | null }>();
  return {
    score: result?.score ?? null,
    quizTitle: result?.quiz_title || quiz.title,
  };
}
