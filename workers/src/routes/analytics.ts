import { Env } from '../types';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../utils/response';

export async function handleAnalyticsRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const match = path.match(/^\/api\/analytics\/class\/([^/]+)$/);
    if (method !== 'GET' || !match) return errorResponse('Analytics Route Not Found', 404);
    const auth = await verifyJWTMiddleware(request, env);
    if (auth instanceof Response) return auth;
    const classId = decodeURIComponent(match[1]);
    const classroom = await env.DB.prepare('SELECT teacher_username FROM classes WHERE id=?').bind(classId).first<any>();
    if (!classroom) return errorResponse('Class not found', 404);
    if (auth.user.role !== 'admin' && (auth.user.role !== 'teacher' || auth.user.username !== classroom.teacher_username)) {
        return errorResponse('Forbidden', 403);
    }
    try {
        const homeworkTrend = await env.DB.prepare(`
          WITH latest AS (
            SELECT hs.* FROM hw_submissions hs
            JOIN (SELECT assignment_id, student_id, MAX(attempt_no) AS attempt_no FROM hw_submissions GROUP BY assignment_id, student_id) x
              ON x.assignment_id=hs.assignment_id AND x.student_id=hs.student_id AND x.attempt_no=hs.attempt_no
            WHERE hs.published_at IS NOT NULL
          )
          SELECT ha.id AS assignment_id, ha.title, AVG(latest.score) AS avg_score, COUNT(latest.id) AS total_submissions
          FROM hw_assignments ha LEFT JOIN latest ON latest.assignment_id=ha.id
          WHERE ha.class_id=? AND COALESCE(ha.archived_at, '')=''
          GROUP BY ha.id ORDER BY datetime(ha.deadline)
        `).bind(classId).all();
        const quizTrend = await env.DB.prepare(`SELECT quiz_id, AVG(score) AS avg_score, COUNT(id) AS total_attempts FROM results WHERE class_id=? GROUP BY quiz_id ORDER BY timestamp ASC`).bind(classId).all();
        const distribution = await env.DB.prepare(`
          WITH latest AS (
            SELECT hs.* FROM hw_submissions hs JOIN hw_assignments ha ON ha.id=hs.assignment_id
            JOIN (SELECT assignment_id, student_id, MAX(attempt_no) AS attempt_no FROM hw_submissions GROUP BY assignment_id, student_id) x
              ON x.assignment_id=hs.assignment_id AND x.student_id=hs.student_id AND x.attempt_no=hs.attempt_no
            WHERE ha.class_id=? AND hs.published_at IS NOT NULL
          ) SELECT score, COUNT(*) AS count FROM latest GROUP BY score ORDER BY score DESC
        `).bind(classId).all();
        return jsonResponse({ status: 'success', data: { homeworkTrend: homeworkTrend.results, quizTrend: quizTrend.results, scoreDistribution: distribution.results, classId } });
    } catch (error) {
        console.error('[Analytics]', error);
        return errorResponse('Failed to fetch analytics data', 500);
    }
}
