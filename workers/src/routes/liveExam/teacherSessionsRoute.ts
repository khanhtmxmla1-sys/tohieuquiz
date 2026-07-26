import { errorResponse, jsonResponse } from '../../utils/response';
import { authenticateTeacher, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// GET /api/live-exam/teacher/:username/sessions
export const handleTeacherSessionsRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/teacher\/[^/]+\/sessions$/.test(context.path)
    || context.method !== 'GET') return null;
  const auth = await authenticateTeacher(context);
  if (isAuthResponse(auth)) return auth.response;
  const teacherUsername = context.path.split('/')[4];
  if (auth.data.username !== teacherUsername) {
    return errorResponse('Forbidden: Can only view your own sessions', 403);
  }

  try {
    const sessions = await context.db.prepare(`
      SELECT s.id, s.title, s.quiz_id, s.teacher_id, s.class_id, s.duration,
             s.scheduled_at, s.started_at, s.ends_at, s.closed_at, s.settings,
             s.status, s.access_code, s.archived_at, s.created_at, s.updated_at,
             q.title AS quiz_title, c.name AS class_name,
             COUNT(p.id) AS participant_count,
             SUM(CASE WHEN p.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_count,
             ROUND(AVG(CASE WHEN p.score IS NOT NULL THEN p.score END), 1) AS average_score
      FROM live_exam_sessions s
      LEFT JOIN quizzes q ON q.id = s.quiz_id
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN live_exam_participants p ON p.live_exam_id = s.id
      WHERE s.teacher_id = ? AND s.archived_at IS NULL
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).bind(auth.data.username).all();
    return jsonResponse((sessions.results || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      quizId: row.quiz_id,
      teacherId: row.teacher_id,
      classId: row.class_id || '',
      className: row.class_name || undefined,
      quizTitle: row.quiz_title || undefined,
      participantCount: Number(row.participant_count || 0),
      submittedCount: Number(row.submitted_count || 0),
      averageScore: row.average_score === null || row.average_score === undefined
        ? undefined
        : Number(row.average_score),
      duration: row.duration,
      scheduledAt: row.scheduled_at || undefined,
      startedAt: row.started_at || undefined,
      endsAt: row.ends_at || undefined,
      closedAt: row.closed_at || undefined,
      settings: row.settings ? JSON.parse(row.settings) : {},
      status: row.status,
      accessCode: row.access_code,
      archivedAt: row.archived_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to get sessions');
  }
};
