import { createParentNotification } from './notificationService';

const toLocalDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export async function createDueHomeworkReminders(
  db: D1Database,
  now: Date,
): Promise<{ targetCount: number; createdCount: number }> {
  const nowIso = now.toISOString();
  const horizonIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const rows = await db.prepare(`
    SELECT ha.id AS assignment_id, s.id AS student_id, ha.title, ha.subject, ha.deadline
    FROM hw_assignments ha
    JOIN students s ON s.class_id = ha.class_id
      AND COALESCE(s.archived_at, '') = ''
    LEFT JOIN hw_submissions hs ON hs.assignment_id = ha.id AND hs.student_id = s.id
    WHERE ha.status = 'OPEN'
      AND COALESCE(ha.archived_at, '') = ''
      AND ha.deadline > ?
      AND ha.deadline <= ?
      AND hs.id IS NULL
    ORDER BY ha.deadline, s.id
  `).bind(nowIso, horizonIso).all<{
    assignment_id: string;
    student_id: string;
    title: string;
    subject: string;
    deadline: string;
  }>();

  const localDate = toLocalDate(now);
  let createdCount = 0;
  for (const row of rows.results) {
    const result = await createParentNotification(db, {
      studentId: row.student_id,
      kind: 'homework_due',
      sourceType: 'homework_due',
      sourceId: `${row.assignment_id}:${localDate}`,
      title: 'Bài tập sắp hết hạn',
      body: `${row.title} sẽ hết hạn trong vòng 24 giờ.`,
      payload: {
        assignmentId: row.assignment_id,
        subject: row.subject || '',
        deadline: row.deadline,
      },
      isImportant: true,
      publishedAt: nowIso,
    });
    if (result.created) createdCount += 1;
  }
  return { targetCount: rows.results.length, createdCount };
}
