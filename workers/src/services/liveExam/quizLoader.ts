import type { D1Database } from '@cloudflare/workers-types';
import type { Quiz } from '../../../../src/types';
import type { LiveExamSession } from '../../../../src/types/liveExam.types';
import { mapLiveExamQuestionRow } from '../liveExamQuestionMapper';
import { LiveExamServiceError } from './errors';

export async function loadLiveExamQuiz(
  db: D1Database,
  session: LiveExamSession,
): Promise<Quiz> {
  const quizRow = await db
    .prepare('SELECT id, title, class_level, time_limit, created_at, created_by FROM quizzes WHERE id = ?')
    .bind(session.quizId)
    .first<any>();
  if (!quizRow) throw new LiveExamServiceError('Quiz not found', 404);

  const questionRows = await db.prepare(`
    SELECT id, type, question, options, correct_answer, items, text_field, blanks,
           distractors, sentence, words, correct_word_indexes, image, difficulty
    FROM questions
    WHERE quiz_id = ?
    ORDER BY rowid ASC
  `).bind(session.quizId).all<any>();

  return {
    id: String(quizRow.id),
    title: String(quizRow.title || session.title),
    classLevel: String(quizRow.class_level || ''),
    timeLimit: Number(quizRow.time_limit || session.duration),
    createdAt: String(quizRow.created_at || session.createdAt),
    createdBy: String(quizRow.created_by || ''),
    questions: (questionRows.results || []).map(mapLiveExamQuestionRow),
  };
}
