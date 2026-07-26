import type {
  ParentDashboardPayload,
  ParentNotificationItem,
} from '../../../shared/parent-portal.contract';

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface IctWeekWindow {
  weekStart: string;
  weekEnd: string;
  previousWeekStart: string;
  currentStartUtc: string;
  currentEndUtc: string;
  previousStartUtc: string;
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86400000);

export function resolveIctWeekWindow(
  requestedWeekStart?: string,
  now = new Date(),
): IctWeekWindow {
  let weekStart = requestedWeekStart;
  if (weekStart) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('Invalid weekStart format');
    const parsed = new Date(`${weekStart}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || formatDate(parsed) !== weekStart) {
      throw new Error('Invalid weekStart date');
    }
    if (parsed.getUTCDay() !== 1) throw new Error('weekStart must be a Monday');
  } else {
    const ictNow = new Date(now.getTime() + ICT_OFFSET_MS);
    const day = ictNow.getUTCDay() || 7;
    weekStart = formatDate(new Date(Date.UTC(
      ictNow.getUTCFullYear(),
      ictNow.getUTCMonth(),
      ictNow.getUTCDate() - (day - 1),
    )));
  }

  const labelDate = new Date(`${weekStart}T00:00:00.000Z`);
  const previous = addDays(labelDate, -7);
  const sunday = addDays(labelDate, 6);
  const nextMonday = addDays(labelDate, 7);
  const toIctUtc = (label: string): string => new Date(`${label}T00:00:00+07:00`).toISOString();
  return {
    weekStart,
    weekEnd: formatDate(sunday),
    previousWeekStart: formatDate(previous),
    currentStartUtc: toIctUtc(weekStart),
    currentEndUtc: toIctUtc(formatDate(nextMonday)),
    previousStartUtc: toIctUtc(formatDate(previous)),
  };
}

export interface ParentDashboardService {
  loadDashboard(
    studentId: string,
    window: IctWeekWindow,
    now: Date,
  ): Promise<ParentDashboardPayload>;
}

const number = (value: unknown): number => Number(value || 0);
const rounded = (value: number, digits = 1): number => Number(value.toFixed(digits));

const parsePayload = (value: unknown): Record<string, unknown> => {
  try { return JSON.parse(String(value || '{}')) as Record<string, unknown>; } catch { return {}; }
};

const mapNotification = (row: Record<string, unknown>): ParentNotificationItem => ({
  id: String(row.id),
  kind: row.kind as ParentNotificationItem['kind'],
  title: String(row.title),
  body: String(row.body || ''),
  payload: parsePayload(row.payload_json),
  isImportant: number(row.is_important) === 1,
  isRead: Boolean(row.read_at),
  publishedAt: String(row.published_at),
  expiresAt: row.expires_at ? String(row.expires_at) : null,
});

export function createParentDashboardService(db: D1Database): ParentDashboardService {
  return {
    async loadDashboard(studentId, window, now) {
      const student = await db.prepare(`
        SELECT s.id, s.full_name, COALESCE(s.avatar, '') AS avatar,
               s.class_id, c.name AS class_name
        FROM students s JOIN classes c ON c.id = s.class_id
        WHERE s.id = ? AND COALESCE(s.archived_at, '') = ''
        LIMIT 1
      `).bind(studentId).first<Record<string, unknown>>();
      if (!student) throw new Error('Parent student not found');

      const metricQuery = `
        SELECT COUNT(*) AS completed,
               COALESCE(AVG(score), 0) AS average_score,
               COALESCE(SUM(time_taken), 0) AS learning_seconds,
               COALESCE(SUM(correct_count), 0) AS correct_count,
               COALESCE(SUM(total_questions), 0) AS total_questions
        FROM results
        WHERE student_id = ? AND submitted_at >= ? AND submitted_at < ?
      `;
      const current = await db.prepare(metricQuery)
        .bind(studentId, window.currentStartUtc, window.currentEndUtc)
        .first<Record<string, unknown>>();
      const previous = await db.prepare(metricQuery)
        .bind(studentId, window.previousStartUtc, window.currentStartUtc)
        .first<Record<string, unknown>>();

      const pending = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM hw_assignments ha
        LEFT JOIN hw_submissions hs
          ON hs.assignment_id = ha.id AND hs.student_id = ?
        WHERE ha.class_id = ? AND ha.status = 'OPEN'
          AND COALESCE(ha.archived_at, '') = ''
          AND ha.deadline > ? AND hs.id IS NULL
      `).bind(studentId, String(student.class_id), now.toISOString())
        .first<{ count: number }>();
      const unread = await db.prepare(`
        SELECT COUNT(*) AS count FROM parent_notifications
        WHERE student_id = ? AND read_at IS NULL AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
      `).bind(studentId, now.toISOString()).first<{ count: number }>();

      const subjectRows = await db.prepare(`
        SELECT COALESCE(NULLIF(q.category, ''), 'Khác') AS subject,
               AVG(r.score) AS average_score,
               SUM(r.correct_count) AS correct_count,
               SUM(r.total_questions) AS question_count
        FROM results r LEFT JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.student_id = ? AND r.submitted_at >= ? AND r.submitted_at < ?
        GROUP BY COALESCE(NULLIF(q.category, ''), 'Khác')
        ORDER BY average_score DESC, subject
      `).bind(studentId, window.currentStartUtc, window.currentEndUtc)
        .all<Record<string, unknown>>();
      const subjects = subjectRows.results.map(row => {
        const questionCount = number(row.question_count);
        return {
          subject: String(row.subject),
          averageScore: rounded(number(row.average_score)),
          correctRate: questionCount ? rounded(number(row.correct_count) * 100 / questionCount, 0) : 0,
          questionCount,
          confidence: questionCount < 10 ? 'low' as const : questionCount < 30 ? 'medium' as const : 'high' as const,
        };
      });

      const quizRows = await db.prepare(`
        SELECT CAST(r.id AS TEXT) AS id, 'quiz' AS type, r.quiz_title AS title,
               COALESCE(NULLIF(q.category, ''), 'Khác') AS subject,
               r.score, r.submitted_at AS occurred_at
        FROM results r LEFT JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.student_id = ?
        ORDER BY r.submitted_at DESC LIMIT 10
      `).bind(studentId).all<Record<string, unknown>>();
      const homeworkRows = await db.prepare(`
        SELECT hs.id, 'homework' AS type, ha.title, COALESCE(ha.subject, '') AS subject,
               CASE WHEN hs.published_at IS NULL THEN NULL ELSE hs.score END AS score,
               hs.submitted_at AS occurred_at
        FROM hw_submissions hs JOIN hw_assignments ha ON ha.id = hs.assignment_id
        WHERE hs.student_id = ?
        ORDER BY hs.submitted_at DESC LIMIT 10
      `).bind(studentId).all<Record<string, unknown>>();
      const recentActivity = [...quizRows.results, ...homeworkRows.results]
        .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
        .slice(0, 10)
        .map(row => ({
          id: String(row.id),
          type: row.type as 'quiz' | 'homework',
          title: String(row.title || ''),
          subject: String(row.subject || ''),
          score: row.score === null || row.score === undefined ? null : number(row.score),
          occurredAt: String(row.occurred_at),
        }));

      const importantRows = await db.prepare(`
        SELECT id, kind, title, body, payload_json, is_important,
               published_at, expires_at, read_at
        FROM parent_notifications
        WHERE student_id = ? AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
          AND (is_important = 1 OR read_at IS NULL)
        ORDER BY is_important DESC, published_at DESC, id DESC LIMIT 3
      `).bind(studentId, now.toISOString()).all<Record<string, unknown>>();

      const completed = number(current?.completed);
      const currentAverage = rounded(number(current?.average_score));
      const previousAverage = rounded(number(previous?.average_score));
      const totalQuestions = number(current?.total_questions);
      const pendingAssignments = number(pending?.count);
      const recommendations: string[] = [];
      if (pendingAssignments > 0) recommendations.push(`Cùng con hoàn thành ${pendingAssignments} bài tập đang chờ.`);
      const weakest = [...subjects].sort((a, b) => a.correctRate - b.correctRate)[0];
      if (weakest && weakest.correctRate < 70) recommendations.push(`Dành 15 phút ôn thêm môn ${weakest.subject}.`);
      if (completed === 0) recommendations.push('Khuyến khích con hoàn thành ít nhất một bài trong tuần này.');
      if (recommendations.length === 0) recommendations.push('Con đang duy trì tiến độ tốt. Hãy tiếp tục động viên con.');

      return {
        student: {
          id: String(student.id),
          fullName: String(student.full_name),
          className: String(student.class_name),
          avatar: String(student.avatar || ''),
        },
        period: {
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          previousWeekStart: window.previousWeekStart,
        },
        metrics: {
          completedQuizzes: completed,
          averageScore: currentAverage,
          learningSeconds: number(current?.learning_seconds),
          correctRate: totalQuestions ? rounded(number(current?.correct_count) * 100 / totalQuestions, 0) : 0,
          pendingAssignments,
          unreadNotifications: number(unread?.count),
        },
        comparison: {
          averageScoreDelta: rounded(currentAverage - previousAverage),
          completedQuizzesDelta: completed - number(previous?.completed),
        },
        subjects,
        recentActivity,
        recommendations,
        importantNotifications: importantRows.results.map(mapNotification),
      };
    },
  };
}
