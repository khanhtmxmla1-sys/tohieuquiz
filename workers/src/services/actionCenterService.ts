import {
  TEACHER_ACTION_CENTER_MAX_ITEMS,
  type TeacherActionCenter,
  type TeacherActionItem,
  type TeacherActionSeverity,
} from '../../../shared/teacher-action-center.contract';

export interface ActionCenterActor {
  role: 'teacher' | 'admin';
  username?: string;
}

interface CountRow {
  action_count?: number | string | null;
  affected_count?: number | string | null;
  next_at?: string | null;
  next_id?: string | null;
}

const severityWeight: Record<TeacherActionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const hoursFrom = (from: Date, rawValue?: string | null): number | null => {
  if (!rawValue) return null;
  const timestamp = Date.parse(rawValue);
  if (!Number.isFinite(timestamp)) return null;
  return (timestamp - from.getTime()) / 3_600_000;
};

const requireScopedUsername = (actor: ActionCenterActor): string => {
  if (actor.role === 'admin') return '';
  const username = String(actor.username || '').trim();
  if (!username) throw new Error('Teacher username is required for action-center scope.');
  return username;
};

const loadAssignmentRisk = async (
  db: D1Database,
  actor: ActionCenterActor,
  now: Date,
): Promise<CountRow> => {
  const username = requireScopedUsername(actor);
  const deadline = new Date(now.getTime() + 48 * 3_600_000).toISOString();
  const teacherScope = actor.role === 'admin' ? '' : 'AND c.teacher_username = ?';
  const bindings: unknown[] = [now.toISOString(), deadline];
  if (username) bindings.push(username);

  return await db.prepare(`
    /* action-center:assignments */
    SELECT
      COUNT(*) AS action_count,
      COALESCE(SUM(missing_count), 0) AS affected_count,
      MIN(deadline) AS next_at
    FROM (
      SELECT
        a.id,
        a.deadline,
        CASE
          WHEN TRIM(COALESCE(a.student_id, '')) <> '' THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM results r
              WHERE r.assignment_id = a.id AND r.student_id = a.student_id
            ) THEN 0 ELSE 1 END
          ELSE (
            SELECT COUNT(*)
            FROM students s
            WHERE s.class_id = a.class_id
              AND s.archived_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM results r
                WHERE r.assignment_id = a.id AND r.student_id = s.id
              )
          )
        END AS missing_count
      FROM assignments a
      JOIN classes c ON c.id = a.class_id AND c.archived_at IS NULL
      WHERE a.status = 'OPEN'
        AND datetime(a.deadline) > datetime(?)
        AND datetime(a.deadline) <= datetime(?)
        ${teacherScope}
    ) scoped_assignments
    WHERE missing_count > 0
  `).bind(...bindings).first<CountRow>() || {};
};

const loadDrafts = async (
  db: D1Database,
  actor: ActionCenterActor,
  now: Date,
): Promise<CountRow> => {
  const username = requireScopedUsername(actor);
  const ownerScope = actor.role === 'admin' ? '' : 'AND owner_username = ?';
  const bindings: unknown[] = [now.toISOString()];
  if (username) bindings.push(username);
  bindings.push(now.toISOString());
  if (username) bindings.push(username);

  return await db.prepare(`
    /* action-center:drafts */
    SELECT
      COUNT(*) AS action_count,
      MAX(updated_at) AS next_at,
      (
        SELECT id
        FROM quiz_drafts latest
        WHERE (latest.expires_at IS NULL OR datetime(latest.expires_at) > datetime(?))
          ${actor.role === 'admin' ? '' : 'AND latest.owner_username = ?'}
        ORDER BY datetime(latest.updated_at) DESC
        LIMIT 1
      ) AS next_id
    FROM quiz_drafts
    WHERE (expires_at IS NULL OR datetime(expires_at) > datetime(?))
      ${ownerScope}
  `).bind(...bindings).first<CountRow>() || {};
};

const loadPendingGiftOrders = async (
  db: D1Database,
  actor: ActionCenterActor,
): Promise<CountRow> => {
  const username = requireScopedUsername(actor);
  const teacherScope = actor.role === 'admin' ? '' : 'AND c.teacher_username = ?';
  const bindings: unknown[] = [];
  if (username) bindings.push(username);

  return await db.prepare(`
    /* action-center:gift-orders */
    SELECT COUNT(*) AS action_count, MIN(o.created_at) AS next_at
    FROM gift_orders o
    JOIN classes c ON c.id = o.class_id
    WHERE o.status = 'VOUCHER_ISSUED'
      ${teacherScope}
  `).bind(...bindings).first<CountRow>() || {};
};

const loadUpcomingLiveExams = async (
  db: D1Database,
  actor: ActionCenterActor,
  now: Date,
): Promise<CountRow> => {
  const username = requireScopedUsername(actor);
  const windowEnd = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const teacherScope = actor.role === 'admin' ? '' : 'AND teacher_id = ?';
  const bindings: unknown[] = [now.toISOString(), windowEnd];
  if (username) bindings.push(username);

  return await db.prepare(`
    /* action-center:live-exams */
    SELECT COUNT(*) AS action_count, MIN(scheduled_at) AS next_at
    FROM live_exam_sessions
    WHERE archived_at IS NULL
      AND status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND datetime(scheduled_at) >= datetime(?)
      AND datetime(scheduled_at) <= datetime(?)
      ${teacherScope}
  `).bind(...bindings).first<CountRow>() || {};
};

export async function loadTeacherActionCenter(
  db: D1Database,
  actor: ActionCenterActor,
  now = new Date(),
): Promise<TeacherActionCenter> {
  requireScopedUsername(actor);
  const generatedAt = now.toISOString();
  const [assignments, drafts, giftOrders, liveExams] = await Promise.all([
    loadAssignmentRisk(db, actor, now),
    loadDrafts(db, actor, now),
    loadPendingGiftOrders(db, actor),
    loadUpcomingLiveExams(db, actor, now),
  ]);

  const items: TeacherActionItem[] = [];
  const assignmentCount = toCount(assignments.action_count);
  const affectedStudents = toCount(assignments.affected_count);
  if (assignmentCount > 0) {
    const remainingHours = hoursFrom(now, assignments.next_at);
    items.push({
      id: 'assignment-at-risk',
      kind: 'assignment_at_risk',
      severity: remainingHours !== null && remainingHours <= 12 ? 'critical' : 'warning',
      title: 'Bài giao sắp đến hạn',
      explanation: `${assignmentCount} bài còn ${affectedStudents} học sinh chưa nộp trong 48 giờ tới.`,
      count: assignmentCount,
      generatedAt,
      cta: { label: 'Xem bài cần xử lý', url: '/teacher/assignments?status=OPEN&due=48' },
    });
  }

  const giftOrderCount = toCount(giftOrders.action_count);
  if (giftOrderCount > 0) {
    items.push({
      id: 'gift-orders-pending',
      kind: 'gift_order_pending',
      severity: 'warning',
      title: 'Đơn đổi quà chờ xử lý',
      explanation: `${giftOrderCount} đơn đã phát mã và đang chờ giáo viên trao quà.`,
      count: giftOrderCount,
      generatedAt,
      cta: { label: 'Mở đơn chờ trao', url: '/teacher/gift-shop?status=VOUCHER_ISSUED' },
    });
  }

  const liveExamCount = toCount(liveExams.action_count);
  if (liveExamCount > 0) {
    items.push({
      id: 'live-exams-upcoming',
      kind: 'live_exam_upcoming',
      severity: 'info',
      title: 'Phiên thi sắp diễn ra',
      explanation: `${liveExamCount} phiên được lên lịch trong 24 giờ tới.`,
      count: liveExamCount,
      generatedAt,
      cta: { label: 'Xem phiên đã lên lịch', url: '/teacher/live-exams?status=scheduled&window=24' },
    });
  }

  const draftCount = toCount(drafts.action_count);
  if (draftCount > 0) {
    items.push({
      id: 'drafts-unpublished',
      kind: 'draft_unpublished',
      severity: 'info',
      title: 'Bản nháp chưa hoàn tất',
      explanation: `${draftCount} bản nháp đang lưu trên máy chủ cần tiếp tục hoặc dọn dẹp.`,
      count: draftCount,
      generatedAt,
      cta: {
        label: 'Tiếp tục bản nháp',
        url: drafts.next_id
          ? `/teacher/quizzes/manual/new?draftId=${encodeURIComponent(drafts.next_id)}`
          : '/teacher/quizzes?mode=create',
      },
    });
  }

  items.sort((left, right) => (
    severityWeight[left.severity] - severityWeight[right.severity]
    || right.count - left.count
    || left.id.localeCompare(right.id)
  ));

  return {
    generatedAt,
    items: items.slice(0, TEACHER_ACTION_CENTER_MAX_ITEMS),
  };
}
