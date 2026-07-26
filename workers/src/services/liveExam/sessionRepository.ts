import type { D1Database } from '@cloudflare/workers-types';
import type { LiveExamSession } from '../../../../src/types/liveExam.types';
import { mapSessionRow } from './utils';

export async function getLiveExamById(
  db: D1Database,
  sessionId: string,
): Promise<LiveExamSession | null> {
  const row = await db.prepare(`
    SELECT s.*, q.title AS quiz_title, c.name AS class_name
    FROM live_exam_sessions s
    LEFT JOIN quizzes q ON q.id = s.quiz_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = ?
  `).bind(sessionId).first<any>();
  return row ? mapSessionRow(row) : null;
}

export async function getLiveExamByAccessCode(
  db: D1Database,
  accessCode: string,
): Promise<LiveExamSession | null> {
  const row = await db.prepare(`
    SELECT s.*, q.title AS quiz_title, c.name AS class_name
    FROM live_exam_sessions s
    LEFT JOIN quizzes q ON q.id = s.quiz_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.access_code = ? AND s.archived_at IS NULL
  `).bind(accessCode).first<any>();
  return row ? mapSessionRow(row) : null;
}
