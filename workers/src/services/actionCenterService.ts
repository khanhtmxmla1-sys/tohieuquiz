import { DEFAULT_MANUAL_QUIZ_DRAFT_TITLE } from '../../../shared/manual-quiz-draft.contract';
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
  bindings.push(DEFAULT_MANUAL_QUIZ_DRAFT_TITLE);

  return await db.prepare(`
    /* action-center:drafts */
    WITH normalized_drafts AS (
      SELECT
        id,
        owner_username,
        updated_at,
        expires_at,
        CASE WHEN json_valid(draft_json) = 1 THEN draft_json ELSE '{}' END AS draft_payload
      FROM quiz_drafts
      WHERE (expires_at IS NULL OR datetime(expires_at) > datetime(?))
        ${ownerScope}
    ),
    actionable_drafts AS (
      SELECT id, owner_username, updated_at, expires_at
      FROM normalized_drafts
      WHERE (
        TRIM(COALESCE(json_extract(draft_payload, '$.quizId'), '')) <> ''
        OR COALESCE(json_array_length(json_extract(draft_payload, '$.quiz.questions')), 0) > 0
        OR (
          TRIM(COALESCE(json_extract(draft_payload, '$.quiz.title'), '')) <> ''
          AND TRIM(COALESCE(json_extract(draft_payload, '$.quiz.title'), '')) <> ?
        )
        OR (
          TRIM(COALESCE(json_extract(draft_payload, '$.quiz.classLevel'), '')) <> ''
          AND TRIM(COALESCE(json_extract(draft_payload, '$.quiz.classLevel'), '')) <> '3'
        )
        OR (
          TRIM(COALESCE(json_extract(draft_payload, '$.quiz.category'), '')) <> ''
          AND TRIM(COALESCE(json_extract(draft_payload, '$.quiz.category'), '')) <> 'toan'
        )
        OR COALESCE(CAST(json_extract(draft_payload, '$.quiz.timeLimit') AS REAL), 15) <> 15
        OR COALESCE(json_array_length(json_extract(draft_payload, '$.quiz.tags')), 0) > 0
        OR COALESCE(json_extract(draft_payload, '$.quiz.requireCode'), 0) = 1
        OR TRIM(COALESCE(json_extract(draft_payload, '$.quiz.accessCode'), '')) <> ''
        OR COALESCE(json_extract(draft_payload, '$.quiz.showOnHome'), 1) = 0
        OR COALESCE(CAST(json_extract(draft_payload, '$.targetPoints') AS REAL), 10) <> 10
      )
    )
    SELECT
      COUNT(*) AS action_count,
      MAX(updated_at) AS next_at,
      (
        SELECT id
        FROM actionable_drafts
        ORDER BY datetime(updated_at) DESC
        LIMIT 1
      ) AS next_id
    FROM actionable_drafts
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
    WHERE o.status = 'PENDING'
      ${teacherScope}
  `).bind(...bindings).first<CountRow>() || {};
};

const loadLowStockGiftItems = async (
  db: D1Database,
  actor: ActionCenterActor,
): Promise<CountRow> => {
  const username = requireScopedUsername(actor);
  const teacherScope = actor.role === 'admin' ? '' : `AND EXISTS (
      SELECT 1
      FROM classes scoped_class
      WHERE scoped_class.teacher_username = ?
        AND scoped_class.archived_at IS NULL
        AND (item.school_id = '' OR item.school_id = scoped_class.teacher_username)
        AND (
          item.scope_type = 'SCHOOL'
          OR (item.scope_type = 'CLASS' AND COALESCE(item.class_id, '') = scoped_class.id)
          OR (item.scope_type = 'GRADE' AND item.grade_level = CAST(substr(scoped_class.name, 1, 1) AS INTEGER))
        )
    )`;
  const bindings: unknown[] = [];
  if (username) bindings.push(username);

  return await db.prepare(`
    /* action-center:gift-low-stock */
    SELECT COUNT(*) AS action_count, MIN(item.updated_at) AS next_at
    FROM gift_catalog_items item
    WHERE item.is_active = 1
      AND item.stock_remaining <= item.low_stock_threshold
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
  const [assignments, drafts, giftOrders, lowStock, liveExams] = await Promise.all([
    loadAssignmentRisk(db, actor, now),
    loadDrafts(db, actor, now),
    loadPendingGiftOrders(db, actor),
    loadLowStockGiftItems(db, actor),
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

  const lowStockCount = toCount(lowStock.action_count);
  if (lowStockCount > 0) {
    items.push({
      id: 'gift-low-stock',
      kind: 'gift_low_stock',
      severity: 'warning',
      title: 'Ph?n th??ng s?p h?t h?ng',
      explanation: `${lowStockCount} ph?n th??ng ?? ch?m ng??ng t?n kho th?p.`,
      count: lowStockCount,
      generatedAt,
      cta: { label: 'Ki?m tra t?n kho', url: '/teacher/gift-shop?tab=catalog&stock=low' },
    });
  }

  const giftOrderCount = toCount(giftOrders.action_count);
  if (giftOrderCount > 0) {
    items.push({
      id: 'gift-orders-pending',
      kind: 'gift_order_pending',
      severity: 'warning',
      title: '??n ??i qu? ch? duy?t',
      explanation: `${giftOrderCount} ??n ?ang ch? gi?o vi?n duy?t tr??c khi trao qu?.`,
      count: giftOrderCount,
      generatedAt,
      cta: { label: 'M? ??n ch? duy?t', url: '/teacher/gift-shop?status=PENDING' },
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
