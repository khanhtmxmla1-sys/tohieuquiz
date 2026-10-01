import { getCurrentWeekKey, getWeekUtcRange } from '../gameLoop/dateKeys';

export type StudentLeaderboardScope = 'class' | 'school';
export type StudentLeaderboardPeriod = 'week' | 'all';

export interface StudentLeaderboardOptions {
  scope: StudentLeaderboardScope;
  period: StudentLeaderboardPeriod;
}

interface StudentLeaderboardRow {
  studentId: string;
  fullName: string;
  avatar: string;
  className: string;
  xu: number;
  rank?: number;
}

interface StudentContext {
  student_id: string;
  class_id: string;
  teacher_username: string;
}

interface LeaderboardQueryRow {
  student_id: string;
  full_name: string;
  username: string;
  avatar: string;
  class_name: string;
  xu: number;
}

export interface StudentLeaderboardData {
  topStudents: StudentLeaderboardRow[];
  currentStudent: (StudentLeaderboardRow & { gapToNext: number | null }) | null;
  totalStudents: number;
  period: StudentLeaderboardPeriod;
  scope: StudentLeaderboardScope;
  updatedAt: string;
}

const mapRow = (row: LeaderboardQueryRow): StudentLeaderboardRow => ({
  studentId: String(row.student_id),
  fullName: String(row.full_name || row.username || row.student_id),
  avatar: String(row.avatar || ''),
  className: String(row.class_name || ''),
  xu: Number(row.xu) || 0,
});

export const getStudentLeaderboard = async (
  db: D1Database,
  username: string,
  options: StudentLeaderboardOptions,
): Promise<StudentLeaderboardData | null> => {
  const context = await db.prepare(`
    SELECT
      s.id AS student_id,
      s.class_id,
      c.teacher_username
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.username = ?
      AND COALESCE(s.archived_at, '') = ''
      AND COALESCE(c.archived_at, '') = ''
    LIMIT 1
  `).bind(username).first<StudentContext>();

  if (!context?.student_id || !context.class_id || !context.teacher_username) return null;

  const bindings: unknown[] = [];
  let periodJoin = '';
  let scoreExpression = 'COALESCE(s.coins, 0)';

  if (options.period === 'week') {
    const weekKey = getCurrentWeekKey();
    const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);
    periodJoin = `
      LEFT JOIN student_reward_ledger ledger
        ON ledger.student_id = s.id
       AND ledger.created_at >= ?
       AND ledger.created_at < ?
       AND ledger.coins_delta > 0
       AND ledger.source_type NOT IN ('BALANCE_OPENING', 'WEEKLY_LEADERBOARD')
    `;
    bindings.push(startIso, endIsoExclusive);
    scoreExpression = 'COALESCE(SUM(ledger.coins_delta), 0)';
  }

  const scopeCondition = options.scope === 'class'
    ? 's.class_id = ?'
    : 'c.teacher_username = ?';
  const participantFilter = options.period === 'week'
    ? `HAVING ${scoreExpression} > 0`
    : '';
  bindings.push(options.scope === 'class' ? context.class_id : context.teacher_username);

  const result = await db.prepare(`
    SELECT
      s.id AS student_id,
      s.username,
      s.full_name,
      s.avatar,
      c.name AS class_name,
      ${scoreExpression} AS xu
    FROM students s
    JOIN classes c ON c.id = s.class_id
    ${periodJoin}
    WHERE ${scopeCondition}
      AND COALESCE(s.archived_at, '') = ''
      AND COALESCE(c.archived_at, '') = ''
    GROUP BY s.id, s.username, s.full_name, s.avatar, c.name, s.coins
    ${participantFilter}
    ORDER BY xu DESC, LOWER(COALESCE(s.full_name, s.username)) ASC, s.id ASC
  `).bind(...bindings).all<LeaderboardQueryRow>();

  const rows = (result.results || []).map(mapRow);
  let previousScore: number | null = null;
  let rank = 0;
  const rankedRows = rows.map((row) => {
    if (previousScore === null || row.xu !== previousScore) {
      rank += 1;
      previousScore = row.xu;
    }
    return { ...row, rank };
  });

  const current = rankedRows.find((row) => row.studentId === String(context.student_id));
  const higherScore = current && current.rank > 1
    ? rankedRows.find((row) => row.rank === current.rank - 1)?.xu
    : undefined;
  const currentStudent = current
    ? {
      ...current,
      gapToNext: higherScore === undefined ? null : higherScore - current.xu,
    }
    : null;

  return {
    topStudents: rankedRows.slice(0, 10),
    currentStudent,
    totalStudents: rankedRows.length,
    period: options.period,
    scope: options.scope,
    updatedAt: new Date().toISOString(),
  };
};
