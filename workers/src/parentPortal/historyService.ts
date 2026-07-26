import type {
  ParentCertificateHistoryItem,
  ParentHistoryPage,
  ParentHomeworkHistoryItem,
  ParentResultHistoryItem,
} from '../../../shared/parent-portal.contract';

export interface ParentHistoryFilters {
  page: number;
  limit: number;
  subject?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ParentHistoryService {
  listResults(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentResultHistoryItem>>;
  getResult(studentId: string, resultId: string): Promise<ParentResultHistoryItem | null>;
  listAssignments(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentHomeworkHistoryItem>>;
  listCertificates(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentCertificateHistoryItem>>;
}

const number = (value: unknown): number => Number(value || 0);
const round = (value: number, digits = 0): number => Number(value.toFixed(digits));

export const classifyScore = (score: number): string => {
  if (score >= 9) return 'Xuất sắc';
  if (score >= 8) return 'Tốt';
  if (score >= 6.5) return 'Khá';
  if (score >= 5) return 'Đạt';
  return 'Cần cố gắng';
};

const pageResult = <T>(items: T[], filters: ParentHistoryFilters, total: number): ParentHistoryPage<T> => ({
  items,
  page: filters.page,
  limit: filters.limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
});

const rangeClauses = (
  column: string,
  filters: ParentHistoryFilters,
  bindings: unknown[],
): string[] => {
  const clauses: string[] = [];
  if (filters.from) {
    clauses.push(`${column} >= ?`);
    bindings.push(filters.from);
  }
  if (filters.to) {
    clauses.push(`${column} < ?`);
    bindings.push(filters.to);
  }
  return clauses;
};

const mapResult = (row: Record<string, unknown>): ParentResultHistoryItem => {
  const correctCount = number(row.correct_count);
  const totalQuestions = number(row.total_questions);
  const score = number(row.score);
  return {
    id: String(row.id),
    quizId: String(row.quiz_id || ''),
    title: String(row.quiz_title || ''),
    subject: String(row.subject || 'Khác'),
    score,
    correctCount,
    totalQuestions,
    correctRate: totalQuestions ? round(correctCount * 100 / totalQuestions) : 0,
    classification: String(row.classification || classifyScore(score)),
    hasTeacherReport: Boolean(row.report_id),
    comment: row.comment ? String(row.comment) : null,
    needsImprovement: row.needs_improvement ? String(row.needs_improvement) : null,
    encouragement: row.encouragement ? String(row.encouragement) : null,
    submittedAt: String(row.submitted_at),
  };
};

export function createParentHistoryService(db: D1Database): ParentHistoryService {
  return {
    async listResults(studentId, filters) {
      const where = ['r.student_id = ?'];
      const bindings: unknown[] = [studentId];
      if (filters.subject) {
        where.push("LOWER(COALESCE(NULLIF(q.category, ''), 'Khác')) = LOWER(?)");
        bindings.push(filters.subject);
      }
      where.push(...rangeClauses('r.submitted_at', filters, bindings));

      const totalRow = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM results r LEFT JOIN quizzes q ON q.id = r.quiz_id
        WHERE ${where.join(' AND ')}
      `).bind(...bindings).first<{ count: number }>();
      const rows = await db.prepare(`
        SELECT CAST(r.id AS TEXT) AS id, r.quiz_id, r.quiz_title,
               COALESCE(NULLIF(q.category, ''), 'Khác') AS subject,
               r.score, r.correct_count, r.total_questions, r.submitted_at,
               p.id AS report_id, p.xep_loai AS classification,
               NULL AS comment, NULL AS needs_improvement, NULL AS encouragement
        FROM results r
        LEFT JOIN quizzes q ON q.id = r.quiz_id
        LEFT JOIN phieu_nhanxet p
          ON p.submission_id = 'result:' || CAST(r.id AS TEXT)
         AND p.student_id = r.student_id
         AND p.status = 'published'
        WHERE ${where.join(' AND ')}
        ORDER BY r.submitted_at DESC, r.id DESC
        LIMIT ? OFFSET ?
      `).bind(
        ...bindings,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ).all<Record<string, unknown>>();
      return pageResult(rows.results.map(mapResult), filters, number(totalRow?.count));
    },

    async getResult(studentId, resultId) {
      const row = await db.prepare(`
        SELECT CAST(r.id AS TEXT) AS id, r.quiz_id, r.quiz_title,
               COALESCE(NULLIF(q.category, ''), 'Khác') AS subject,
               r.score, r.correct_count, r.total_questions, r.submitted_at,
               p.id AS report_id, p.xep_loai AS classification,
               p.nhan_xet AS comment,
               p.noi_dung_co_gang AS needs_improvement,
               p.loi_dong_vien AS encouragement
        FROM results r
        LEFT JOIN quizzes q ON q.id = r.quiz_id
        LEFT JOIN phieu_nhanxet p
          ON p.submission_id = 'result:' || CAST(r.id AS TEXT)
         AND p.student_id = r.student_id
         AND p.status = 'published'
        WHERE r.id = ? AND r.student_id = ?
        LIMIT 1
      `).bind(resultId, studentId).first<Record<string, unknown>>();
      return row ? mapResult(row) : null;
    },

    async listAssignments(studentId, filters) {
      const student = await db.prepare(`
        SELECT class_id FROM students
        WHERE id = ? AND COALESCE(archived_at, '') = '' LIMIT 1
      `).bind(studentId).first<{ class_id: string }>();
      if (!student) return pageResult([], filters, 0);

      const where = ["ha.class_id = ?", "COALESCE(ha.archived_at, '') = ''", "ha.status <> 'DRAFT'"];
      const bindings: unknown[] = [student.class_id];
      if (filters.subject) {
        where.push("LOWER(COALESCE(ha.subject, '')) = LOWER(?)");
        bindings.push(filters.subject);
      }
      where.push(...rangeClauses('ha.deadline', filters, bindings));
      const totalRow = await db.prepare(`
        SELECT COUNT(*) AS count FROM hw_assignments ha
        WHERE ${where.join(' AND ')}
      `).bind(...bindings).first<{ count: number }>();
      const rows = await db.prepare(`
        WITH latest AS (
          SELECT hs.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY hs.assignment_id
                   ORDER BY hs.attempt_no DESC, hs.submitted_at DESC, hs.id DESC
                 ) AS row_no
          FROM hw_submissions hs
          WHERE hs.student_id = ?
        )
        SELECT ha.id AS assignment_id, ha.title,
               COALESCE(ha.subject, '') AS subject, ha.deadline,
               latest.id AS submission_id, latest.score,
               latest.teacher_feedback, latest.submitted_at, latest.published_at,
               CASE
                 WHEN latest.published_at IS NOT NULL THEN 'graded'
                 WHEN latest.id IS NOT NULL THEN 'submitted'
                 WHEN ha.deadline <= datetime('now') THEN 'overdue'
                 ELSE 'pending'
               END AS parent_status
        FROM hw_assignments ha
        LEFT JOIN latest ON latest.assignment_id = ha.id AND latest.row_no = 1
        WHERE ${where.join(' AND ')}
        ORDER BY ha.deadline DESC, ha.id DESC
        LIMIT ? OFFSET ?
      `).bind(
        studentId,
        ...bindings,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ).all<Record<string, unknown>>();
      const items = rows.results.map((row): ParentHomeworkHistoryItem => ({
        id: row.submission_id ? String(row.submission_id) : `assignment:${String(row.assignment_id)}`,
        assignmentId: String(row.assignment_id),
        title: String(row.title),
        subject: String(row.subject || ''),
        deadline: String(row.deadline),
        status: row.parent_status as ParentHomeworkHistoryItem['status'],
        score: row.published_at ? number(row.score) : null,
        teacherFeedback: row.teacher_feedback ? String(row.teacher_feedback) : null,
        submittedAt: row.submitted_at ? String(row.submitted_at) : null,
        publishedAt: row.published_at ? String(row.published_at) : null,
      }));
      return pageResult(items, filters, number(totalRow?.count));
    },

    async listCertificates(studentId, filters) {
      const where = ["c.student_id = ?", "c.status = 'sent'"];
      const bindings: unknown[] = [studentId];
      where.push(...rangeClauses('c.issued_at', filters, bindings));
      if (filters.subject) {
        where.push("LOWER(COALESCE(c.quiz_title, '')) LIKE LOWER(?)");
        bindings.push(`%${filters.subject}%`);
      }
      const totalRow = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM certificates c
        WHERE ${where.join(' AND ')}
      `).bind(...bindings).first<{ count: number }>();
      const rows = await db.prepare(`
        SELECT c.id, c.batch_id, cb.title, cb.message,
               COALESCE(t.full_name, cb.teacher_id) AS teacher_name,
               c.quiz_title, c.student_score, c.image_url,
               c.issued_at, c.sent_at, c.status
        FROM certificates c
        JOIN certificate_batches cb ON cb.id = c.batch_id
        LEFT JOIN teachers t ON t.username = cb.teacher_id
        WHERE ${where.join(' AND ')}
        ORDER BY c.issued_at DESC, c.id DESC
        LIMIT ? OFFSET ?
      `).bind(
        ...bindings,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ).all<Record<string, unknown>>();
      const items = rows.results.map((row): ParentCertificateHistoryItem => ({
        id: String(row.id),
        batchId: String(row.batch_id),
        title: String(row.title),
        teacherName: String(row.teacher_name || ''),
        message: row.message ? String(row.message) : null,
        quizTitle: row.quiz_title ? String(row.quiz_title) : null,
        studentScore: row.student_score === null || row.student_score === undefined
          ? null
          : number(row.student_score),
        imageUrl: row.image_url ? String(row.image_url) : null,
        issuedAt: String(row.issued_at),
        sentAt: row.sent_at ? String(row.sent_at) : null,
        status: 'sent',
      }));
      return pageResult(items, filters, number(totalRow?.count));
    },
  };
}
