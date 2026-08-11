import { WEEKLY_QUESTS } from '../gameLoop/constants';
import { getCurrentDateKey, getCurrentWeekKey, getPreviousDateKey, getWeekUtcRange } from '../gameLoop/dateKeys';
import { normalizeGameLoopCategory } from '../gameLoop/normalization';

export interface RewardReconciliationRow {
  studentId: string;
  username: string;
  walletCoins: number;
  ledgerCoins: number;
  difference: number;
}

export interface SuspiciousRewardGrowthRow {
  studentId: string;
  username: string;
  walletCoins: number;
  coinsGrowth: number;
  rewardEvents: number;
  largestSingleDelta: number;
}

export const getRewardReconciliationReport = async (
  db: D1Database,
  limit = 100,
): Promise<RewardReconciliationRow[]> => {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
  const rows = await db.prepare(`
    SELECT student_id, username, wallet_coins, ledger_coins, difference
    FROM student_reward_reconciliation
    WHERE difference <> 0
    ORDER BY ABS(difference) DESC, student_id ASC
    LIMIT ?
  `).bind(safeLimit).all<any>();
  return (rows.results || []).map((row: any) => ({
    studentId: String(row.student_id || ''),
    username: String(row.username || ''),
    walletCoins: Number(row.wallet_coins) || 0,
    ledgerCoins: Number(row.ledger_coins) || 0,
    difference: Number(row.difference) || 0,
  }));
};

export const getSuspiciousRewardGrowthReport = async (
  db: D1Database,
  sinceIso: string,
  thresholdCoins = 1_000,
  limit = 100,
): Promise<SuspiciousRewardGrowthRow[]> => {
  const threshold = Math.max(1, Math.floor(Number(thresholdCoins) || 1_000));
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
  const rows = await db.prepare(`
    SELECT s.id AS student_id,
           s.username,
           COALESCE(s.coins, 0) AS wallet_coins,
           SUM(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) AS coins_growth,
           COUNT(*) AS reward_events,
           MAX(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) AS largest_single_delta
    FROM student_reward_ledger l
    JOIN students s ON s.id = l.student_id
    WHERE l.created_at >= ?
      AND l.source_type <> 'BALANCE_OPENING'
    GROUP BY s.id, s.username, s.coins
    HAVING SUM(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) >= ?
    ORDER BY coins_growth DESC, reward_events DESC, s.id ASC
    LIMIT ?
  `).bind(sinceIso, threshold, safeLimit).all<any>();
  return (rows.results || []).map((row: any) => ({
    studentId: String(row.student_id || ''),
    username: String(row.username || ''),
    walletCoins: Number(row.wallet_coins) || 0,
    coinsGrowth: Number(row.coins_growth) || 0,
    rewardEvents: Number(row.reward_events) || 0,
    largestSingleDelta: Number(row.largest_single_delta) || 0,
  }));
};

export const rebuildCurrentWeekProgress = async (
  db: D1Database,
  now = new Date(),
): Promise<{
  weekKey: string;
  scanned: number;
  recorded: number;
  alreadyRecorded: number;
  rebuiltStudents: number;
  rebuiltDays: number;
}> => {
  const weekKey = getCurrentWeekKey(now);
  const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);
  const startDateKey = getCurrentDateKey(new Date(startIso));
  const endDateKey = getPreviousDateKey(getCurrentDateKey(new Date(endIsoExclusive)));
  const rebuiltAt = now.toISOString();
  const rows = await db.prepare(`
    SELECT r.id,
           r.student_id,
           r.class_id,
           r.quiz_id,
           r.score,
           r.correct_count,
           r.total_questions,
           r.submitted_at,
           s.username,
           COALESCE(q.category, '') AS category
    FROM results r
    JOIN students s ON s.id = r.student_id
    LEFT JOIN quizzes q ON q.id = r.quiz_id
    WHERE r.submitted_at >= ?
      AND r.submitted_at < ?
      AND r.student_id IS NOT NULL
      AND r.class_id IS NOT NULL
    ORDER BY r.submitted_at ASC, r.id ASC
  `).bind(startIso, endIsoExclusive).all<any>();

  type DailyAggregate = {
    username: string;
    dateKey: string;
    questions: number;
    correct: number;
    quizzes: number;
    toan: number;
    tiengViet: number;
  };
  type SubjectAggregate = { firstResultId: string; firstSubmittedAt: string };
  type StudentAggregate = {
    studentId: string;
    username: string;
    quizzes: number;
    correct: number;
    currentPerfectStreak: number;
    maxPerfectStreak: number;
    subjects: Map<string, SubjectAggregate>;
  };
  type ClassAggregate = {
    studentId: string;
    username: string;
    score: number;
    correct: number;
    firstSubmittedAt: string;
  };

  const daily = new Map<string, DailyAggregate>();
  const students = new Map<string, StudentAggregate>();
  const classes = new Map<string, Map<string, ClassAggregate>>();
  const supportedSubjects = new Set(['toan', 'tieng-viet', 'tieng-anh']);

  for (const row of rows.results || []) {
    const username = String(row.username || '').trim();
    const studentId = String(row.student_id || '').trim();
    const classId = String(row.class_id || '').trim();
    const submittedAt = String(row.submitted_at || '').trim();
    if (!username || !studentId || !classId || !submittedAt) continue;

    const submittedDate = new Date(submittedAt);
    if (Number.isNaN(submittedDate.getTime())) continue;
    const dateKey = getCurrentDateKey(submittedDate);
    const totalQuestions = Math.max(0, Math.floor(Number(row.total_questions) || 0));
    const correctCount = Math.max(0, Math.floor(Number(row.correct_count) || 0));
    const score = Number.isFinite(Number(row.score)) ? Number(row.score) : 0;
    const category = normalizeGameLoopCategory(String(row.category || ''));
    const resultId = String(row.id);

    const dailyKey = `${username}\u0000${dateKey}`;
    const dailyAggregate = daily.get(dailyKey) || {
      username,
      dateKey,
      questions: 0,
      correct: 0,
      quizzes: 0,
      toan: 0,
      tiengViet: 0,
    };
    dailyAggregate.questions += totalQuestions;
    dailyAggregate.correct += correctCount;
    dailyAggregate.quizzes += 1;
    if (category === 'toan') dailyAggregate.toan += 1;
    if (category === 'tieng-viet') dailyAggregate.tiengViet += 1;
    daily.set(dailyKey, dailyAggregate);

    const studentAggregate = students.get(username) || {
      studentId,
      username,
      quizzes: 0,
      correct: 0,
      currentPerfectStreak: 0,
      maxPerfectStreak: 0,
      subjects: new Map<string, SubjectAggregate>(),
    };
    studentAggregate.quizzes += 1;
    studentAggregate.correct += correctCount;
    if (totalQuestions > 0 && correctCount === totalQuestions) {
      studentAggregate.currentPerfectStreak += 1;
      studentAggregate.maxPerfectStreak = Math.max(
        studentAggregate.maxPerfectStreak,
        studentAggregate.currentPerfectStreak,
      );
    } else {
      studentAggregate.currentPerfectStreak = 0;
    }
    if (supportedSubjects.has(category) && !studentAggregate.subjects.has(category)) {
      studentAggregate.subjects.set(category, {
        firstResultId: resultId,
        firstSubmittedAt: submittedAt,
      });
    }
    students.set(username, studentAggregate);

    const classStudents = classes.get(classId) || new Map<string, ClassAggregate>();
    const classAggregate = classStudents.get(studentId) || {
      studentId,
      username,
      score: 0,
      correct: 0,
      firstSubmittedAt: submittedAt,
    };
    classAggregate.score += score;
    classAggregate.correct += correctCount;
    if (submittedAt < classAggregate.firstSubmittedAt) {
      classAggregate.firstSubmittedAt = submittedAt;
    }
    classStudents.set(studentId, classAggregate);
    classes.set(classId, classStudents);
  }

  const topFiveUsernames = new Set<string>();
  for (const classStudents of classes.values()) {
    const ranked = [...classStudents.values()].sort((left, right) => (
      right.score - left.score
      || right.correct - left.correct
      || left.firstSubmittedAt.localeCompare(right.firstSubmittedAt)
      || left.studentId.localeCompare(right.studentId)
    ));
    for (const entry of ranked.slice(0, 5)) topFiveUsernames.add(entry.username);
  }

  const statements: D1PreparedStatement[] = [
    db.prepare(`
      UPDATE student_daily_progress
      SET questions_answered = 0,
          correct_answers = 0,
          quizzes_completed = 0,
          toan_quizzes_completed = 0,
          tieng_viet_quizzes_completed = 0,
          updated_at = ?
      WHERE progress_date >= ? AND progress_date <= ?
    `).bind(rebuiltAt, startDateKey, endDateKey),
    db.prepare(`
      UPDATE student_weekly_progress
      SET progress = 0, updated_at = ?
      WHERE week_key = ?
        AND quest_id IN (
          'weekly_20_quizzes', 'weekly_top_5', 'weekly_100_correct',
          'weekly_subject_master', 'weekly_perfect_streak'
        )
    `).bind(rebuiltAt, weekKey),
    db.prepare('DELETE FROM student_weekly_subjects WHERE week_key = ?').bind(weekKey),
    db.prepare('DELETE FROM student_weekly_state WHERE week_key = ?').bind(weekKey),
  ];

  for (const aggregate of daily.values()) {
    statements.push(db.prepare(`
      INSERT INTO student_daily_progress (
        username, progress_date, questions_answered, correct_answers,
        quizzes_completed, toan_quizzes_completed, tieng_viet_quizzes_completed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username, progress_date) DO UPDATE SET
        questions_answered = excluded.questions_answered,
        correct_answers = excluded.correct_answers,
        quizzes_completed = excluded.quizzes_completed,
        toan_quizzes_completed = excluded.toan_quizzes_completed,
        tieng_viet_quizzes_completed = excluded.tieng_viet_quizzes_completed,
        updated_at = excluded.updated_at
    `).bind(
      aggregate.username,
      aggregate.dateKey,
      aggregate.questions,
      aggregate.correct,
      aggregate.quizzes,
      aggregate.toan,
      aggregate.tiengViet,
      rebuiltAt,
      rebuiltAt,
    ));
  }

  for (const aggregate of students.values()) {
    for (const quest of WEEKLY_QUESTS) {
      statements.push(db.prepare(`
        INSERT INTO student_weekly_progress (
          username, week_key, quest_id, progress, target, claimed, created_at, updated_at
        ) VALUES (?, ?, ?, 0, ?, 0, ?, ?)
        ON CONFLICT(username, week_key, quest_id) DO UPDATE SET
          target = excluded.target,
          updated_at = excluded.updated_at
      `).bind(aggregate.username, weekKey, quest.id, quest.target, rebuiltAt, rebuiltAt));
    }

    statements.push(
      db.prepare(`
        UPDATE student_weekly_progress
        SET progress = CASE quest_id
              WHEN 'weekly_20_quizzes' THEN ?
              WHEN 'weekly_top_5' THEN ?
              WHEN 'weekly_100_correct' THEN ?
              WHEN 'weekly_subject_master' THEN ?
              WHEN 'weekly_perfect_streak' THEN ?
              ELSE progress
            END,
            updated_at = ?
        WHERE username = ? AND week_key = ?
          AND quest_id IN (
            'weekly_20_quizzes', 'weekly_top_5', 'weekly_100_correct',
            'weekly_subject_master', 'weekly_perfect_streak'
          )
      `).bind(
        aggregate.quizzes,
        topFiveUsernames.has(aggregate.username) ? 1 : 0,
        aggregate.correct,
        aggregate.subjects.size,
        aggregate.maxPerfectStreak,
        rebuiltAt,
        aggregate.username,
        weekKey,
      ),
      db.prepare(`
        INSERT INTO student_weekly_state (
          username, week_key, current_perfect_streak, max_perfect_streak,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(username, week_key) DO UPDATE SET
          current_perfect_streak = excluded.current_perfect_streak,
          max_perfect_streak = excluded.max_perfect_streak,
          updated_at = excluded.updated_at
      `).bind(
        aggregate.username,
        weekKey,
        aggregate.currentPerfectStreak,
        aggregate.maxPerfectStreak,
        rebuiltAt,
        rebuiltAt,
      ),
    );

    for (const [subjectKey, subject] of aggregate.subjects) {
      statements.push(db.prepare(`
        INSERT INTO student_weekly_subjects (
          username, week_key, subject_key, first_result_id, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        aggregate.username,
        weekKey,
        subjectKey,
        subject.firstResultId,
        subject.firstSubmittedAt,
      ));
    }
  }

  await db.batch(statements);
  const scanned = (rows.results || []).length;
  return {
    weekKey,
    scanned,
    recorded: scanned,
    alreadyRecorded: 0,
    rebuiltStudents: students.size,
    rebuiltDays: daily.size,
  };
};