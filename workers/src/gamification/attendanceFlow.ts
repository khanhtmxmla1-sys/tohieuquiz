import { getCurrentDateKey } from '../gameLoop/dateKeys';
import { resolveStudentRewardIdentity } from './rewardIdentity';
import {
  applyStudentReward,
  parseRewardPayload,
  type StudentRewardLedgerRow,
} from './studentRewardLedger';
import { generateId } from '../utils/response';

export const ATTENDANCE_REWARD = { coins: 5, exp: 10 } as const;
const ATTENDANCE_QUESTION_COUNT = 2;

const parseJson = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(value ?? '')) as T;
  } catch {
    return fallback;
  }
};

const parseDateKeyToUtc = (dateKey: string): Date => {
  const [year, month, day] = String(dateKey || '').split('-').map((value) => Number(value || 0));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatUtcDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStartDateKey = (dateKey: string): string => {
  const date = parseDateKeyToUtc(dateKey);
  const dayOfWeek = date.getUTCDay();
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + offsetToMonday);
  return formatUtcDateKey(date);
};

const calculateStreak = (days: string[], endDateKey: string): number => {
  const daySet = new Set(days);
  const cursor = parseDateKeyToUtc(endDateKey);
  let streak = 0;
  while (daySet.has(formatUtcDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

const loadStudent = async (db: D1Database, username: string) => db.prepare(`
  SELECT id, username, class_id
  FROM students
  WHERE username = ?
  LIMIT 1
`).bind(username).first<any>();

const loadAvailability = async (db: D1Database, classId: string) => {
  const [settings, count] = await Promise.all([
    db.prepare(`
      SELECT is_enabled
      FROM class_attendance_settings
      WHERE class_id = ?
      LIMIT 1
    `).bind(classId).first<any>(),
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM class_attendance_questions
      WHERE class_id = ? AND is_active = 1
    `).bind(classId).first<any>(),
  ]);
  const enabled = Number(settings?.is_enabled) === 1;
  const questionCount = Number(count?.count) || 0;
  return {
    enabled,
    questionCount,
    available: enabled && questionCount >= ATTENDANCE_QUESTION_COUNT,
  };
};

const loadClaimDates = async (db: D1Database, username: string, throughDate: string) => {
  const rows = await db.prepare(`
    SELECT claim_date
    FROM attendance_claims
    WHERE username = ? AND claim_date <= ?
    ORDER BY claim_date ASC
  `).bind(username, throughDate).all<any>();
  return (rows.results || []).map((row: any) => String(row.claim_date || '')).filter(Boolean);
};

const loadWeekClaimDates = async (
  db: D1Database,
  username: string,
  weekStart: string,
  throughDate: string,
) => {
  const rows = await db.prepare(`
    SELECT claim_date
    FROM attendance_claims
    WHERE username = ? AND claim_date >= ? AND claim_date <= ?
    ORDER BY claim_date ASC
  `).bind(username, weekStart, throughDate).all<any>();
  return (rows.results || []).map((row: any) => String(row.claim_date || '')).filter(Boolean);
};

const deserializeRichText = (value: unknown) => {
  if (!value) return undefined;
  return parseJson(value, value);
};

const mapAttemptItem = (row: any) => ({
  id: String(row.id),
  questionId: String(row.question_id || ''),
  position: Number(row.position) || 0,
  question: String(row.question_text || ''),
  questionRichText: deserializeRichText(row.question_rich_text),
  options: parseJson<string[]>(row.options_json, []),
  image: String(row.image_url || ''),
  imageAlt: String(row.image_alt || ''),
  selectedAnswer: row.selected_answer ? String(row.selected_answer) : null,
  isAnswered: Boolean(row.selected_answer),
  ...(row.selected_answer === null || row.selected_answer === undefined
    ? {}
    : { isCorrect: Number(row.is_correct) === 1 }),
});

const loadAttempt = async (
  db: D1Database,
  studentId: string,
  dateKey: string,
  attemptId?: string,
) => {
  const attempt = attemptId
    ? await db.prepare(`
        SELECT *
        FROM attendance_attempts
        WHERE id = ? AND student_id = ? AND attempt_date = ?
        LIMIT 1
      `).bind(attemptId, studentId, dateKey).first<any>()
    : await db.prepare(`
        SELECT *
        FROM attendance_attempts
        WHERE student_id = ? AND attempt_date = ?
        LIMIT 1
      `).bind(studentId, dateKey).first<any>();
  if (!attempt) return null;

  const items = await db.prepare(`
    SELECT *
    FROM attendance_attempt_items
    WHERE attempt_id = ?
    ORDER BY position ASC
  `).bind(attempt.id).all<any>();

  const mappedItems = (items.results || []).map(mapAttemptItem);
  return {
    attemptId: String(attempt.id),
    status: String(attempt.status),
    completed: String(attempt.status) === 'COMPLETED',
    correctCount: Number(attempt.correct_count) || 0,
    totalQuestions: Number(attempt.total_questions) || ATTENDANCE_QUESTION_COUNT,
    answeredCount: mappedItems.filter((item: any) => item.isAnswered).length,
    items: mappedItems,
  };
};

const loadRewardReceipt = async (
  db: D1Database,
  studentId: string,
  dateKey: string,
): Promise<{ awardedCoins: number; awardedExp: number } | null> => {
  const ledger = await db.prepare(`
    SELECT id, student_id, source_type, source_key, reward_type,
           coins_delta, exp_delta, payload_json, created_at
    FROM student_reward_ledger
    WHERE student_id = ?
      AND source_type = 'DAILY_ATTENDANCE'
      AND source_key = ?
    LIMIT 1
  `).bind(studentId, dateKey).first<StudentRewardLedgerRow>();
  if (!ledger) return null;
  const stored = parseRewardPayload<any>(ledger, {});
  return {
    awardedCoins: Number(stored.awardedCoins ?? ledger.coins_delta) || 0,
    awardedExp: Number(stored.awardedExp ?? ledger.exp_delta) || 0,
  };
};

export const getAttendanceStatus = async (db: D1Database, username: string) => {
  const student = await loadStudent(db, username);
  if (!student?.id || !student?.class_id) return null;

  const todayDateKey = getCurrentDateKey();
  const weekStartDateKey = getWeekStartDateKey(todayDateKey);
  const [availability, weekClaimDates, allClaimDates, attempt] = await Promise.all([
    loadAvailability(db, String(student.class_id)),
    loadWeekClaimDates(db, username, weekStartDateKey, todayDateKey),
    loadClaimDates(db, username, todayDateKey),
    loadAttempt(db, String(student.id), todayDateKey),
  ]);
  const claimedToday = weekClaimDates.includes(todayDateKey);
  const attendanceDayNumber = claimedToday ? weekClaimDates.length : weekClaimDates.length + 1;

  return {
    ...availability,
    claimedToday,
    claimDates: weekClaimDates,
    streakDays: calculateStreak(allClaimDates, todayDateKey),
    attendanceDayNumber,
    nextRewardCoins: ATTENDANCE_REWARD.coins,
    nextRewardExp: ATTENDANCE_REWARD.exp,
    todayDateKey,
    weekStartDateKey,
    attempt: attempt
      ? {
          attemptId: attempt.attemptId,
          status: attempt.status,
          answeredCount: attempt.answeredCount,
          correctCount: attempt.correctCount,
          totalQuestions: attempt.totalQuestions,
        }
      : null,
  };
};

export const startAttendanceAttempt = async (db: D1Database, username: string) => {
  const student = await loadStudent(db, username);
  if (!student?.id || !student?.class_id) {
    return { error: 'Student not found', status: 404 } as const;
  }

  const todayDateKey = getCurrentDateKey();
  const existingClaim = await db.prepare(`
    SELECT id
    FROM attendance_claims
    WHERE username = ? AND claim_date = ?
    LIMIT 1
  `).bind(username, todayDateKey).first<any>();
  if (existingClaim) {
    return { error: 'Hôm nay em đã điểm danh rồi.', status: 409 } as const;
  }

  const existing = await loadAttempt(db, String(student.id), todayDateKey);
  if (existing) return { data: existing } as const;

  const availability = await loadAvailability(db, String(student.class_id));
  if (!availability.available) {
    return { error: 'Điểm danh hiện đang tắt hoặc chưa đủ câu hỏi.', status: 409 } as const;
  }

  const questions = await db.prepare(`
    SELECT id, question_text, question_rich_text, options_json, correct_answer, image_url, image_alt
    FROM class_attendance_questions
    WHERE class_id = ? AND is_active = 1
    ORDER BY RANDOM()
    LIMIT ?
  `).bind(student.class_id, ATTENDANCE_QUESTION_COUNT).all<any>();
  if ((questions.results || []).length < ATTENDANCE_QUESTION_COUNT) {
    return { error: 'Chưa đủ câu hỏi điểm danh.', status: 409 } as const;
  }

  const attemptId = generateId('atta');
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO attendance_attempts (
        id, student_id, username, class_id, attempt_date, status,
        correct_count, total_questions, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', 0, ?, ?, NULL)
    `).bind(
      attemptId,
      student.id,
      username,
      student.class_id,
      todayDateKey,
      ATTENDANCE_QUESTION_COUNT,
      now,
    ),
  ];

  (questions.results || []).forEach((question: any, index: number) => {
    statements.push(
      db.prepare(`
        INSERT INTO attendance_attempt_items (
          id, attempt_id, question_id, position, question_text, question_rich_text,
          options_json, correct_answer, image_url, image_alt,
          selected_answer, is_correct, answered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      `).bind(
        generateId('attai'),
        attemptId,
        question.id,
        index + 1,
        question.question_text,
        question.question_rich_text ?? null,
        question.options_json,
        String(question.correct_answer || '').toUpperCase(),
        question.image_url ?? null,
        question.image_alt ?? null,
      ),
    );
  });

  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await loadAttempt(db, String(student.id), todayDateKey);
    if (raced) return { data: raced } as const;
    throw error;
  }

  const created = await loadAttempt(db, String(student.id), todayDateKey);
  if (!created) throw new Error('Attendance attempt missing after creation');
  return { data: created } as const;
};

const awardAttendance = async (
  db: D1Database,
  studentId: string,
  username: string,
  dateKey: string,
) => {
  const identity = await resolveStudentRewardIdentity(db, username);
  if (!identity || identity.studentId !== studentId) throw new Error('Student reward identity mismatch');

  const claimId = generateId('att');
  const createdAt = new Date().toISOString();
  const rewardResult = await applyStudentReward(db, {
    ...identity,
    sourceType: 'DAILY_ATTENDANCE',
    sourceKey: dateKey,
    rewardType: 'COINS_EXP',
    coinsDelta: ATTENDANCE_REWARD.coins,
    expDelta: ATTENDANCE_REWARD.exp,
    payload: {
      awardedCoins: ATTENDANCE_REWARD.coins,
      awardedExp: ATTENDANCE_REWARD.exp,
      todayDateKey: dateKey,
    },
    extraStatements: [
      db.prepare(`
        INSERT INTO attendance_claims
          (id, username, claim_date, reward_exp, reward_coins, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        claimId,
        username,
        dateKey,
        ATTENDANCE_REWARD.exp,
        ATTENDANCE_REWARD.coins,
        createdAt,
      ),
    ],
  });

  const receipt = await loadRewardReceipt(db, studentId, dateKey);
  return {
    awardedCoins: receipt?.awardedCoins ?? ATTENDANCE_REWARD.coins,
    awardedExp: receipt?.awardedExp ?? ATTENDANCE_REWARD.exp,
    newCoins: rewardResult.wallet.coins,
    newLevel: rewardResult.wallet.level,
    newExp: rewardResult.wallet.exp,
    newExpToNext: rewardResult.wallet.expToNext,
  };
};

export const answerAttendanceAttempt = async (
  db: D1Database,
  username: string,
  input: { attemptId: unknown; itemId: unknown; selectedAnswer: unknown },
) => {
  const student = await loadStudent(db, username);
  if (!student?.id || !student?.class_id) {
    return { error: 'Student not found', status: 404 } as const;
  }

  const todayDateKey = getCurrentDateKey();
  const attemptId = String(input.attemptId || '').trim();
  const itemId = String(input.itemId || '').trim();
  const selectedAnswer = String(input.selectedAnswer || '').trim().toUpperCase();
  if (!attemptId || !itemId || !/^[A-D]$/.test(selectedAnswer)) {
    return { error: 'Dữ liệu trả lời không hợp lệ.', status: 400 } as const;
  }

  const attempt = await db.prepare(`
    SELECT *
    FROM attendance_attempts
    WHERE id = ? AND student_id = ? AND attempt_date = ?
    LIMIT 1
  `).bind(attemptId, student.id, todayDateKey).first<any>();
  if (!attempt) return { error: 'Không tìm thấy lượt điểm danh.', status: 404 } as const;

  if (String(attempt.status) === 'COMPLETED') {
    const loaded = await loadAttempt(db, String(student.id), todayDateKey, attemptId);
    const receipt = await loadRewardReceipt(db, String(student.id), todayDateKey);
    return {
      data: {
        ...loaded,
        completed: true,
        awardedCoins: receipt?.awardedCoins ?? 0,
        awardedExp: receipt?.awardedExp ?? 0,
      },
    } as const;
  }

  const item = await db.prepare(`
    SELECT *
    FROM attendance_attempt_items
    WHERE id = ? AND attempt_id = ?
    LIMIT 1
  `).bind(itemId, attemptId).first<any>();
  if (!item) return { error: 'Không tìm thấy câu hỏi trong lượt điểm danh.', status: 404 } as const;

  const options = parseJson<string[]>(item.options_json, []);
  const selectedIndex = selectedAnswer.charCodeAt(0) - 65;
  if (selectedIndex < 0 || selectedIndex >= options.length) {
    return { error: 'Đáp án đã chọn không hợp lệ.', status: 400 } as const;
  }

  if (!item.selected_answer) {
    const isCorrect = selectedAnswer === String(item.correct_answer || '').toUpperCase();
    await db.prepare(`
      UPDATE attendance_attempt_items
      SET selected_answer = ?, is_correct = ?, answered_at = ?
      WHERE id = ? AND attempt_id = ? AND selected_answer IS NULL
    `).bind(selectedAnswer, isCorrect ? 1 : 0, new Date().toISOString(), itemId, attemptId).run();
  }

  const aggregate = await db.prepare(`
    SELECT
      SUM(CASE WHEN selected_answer IS NOT NULL THEN 1 ELSE 0 END) AS answered_count,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
    FROM attendance_attempt_items
    WHERE attempt_id = ?
  `).bind(attemptId).first<any>();
  const answeredCount = Number(aggregate?.answered_count) || 0;
  const correctCount = Number(aggregate?.correct_count) || 0;

  if (answeredCount < ATTENDANCE_QUESTION_COUNT) {
    await db.prepare(`
      UPDATE attendance_attempts
      SET correct_count = ?
      WHERE id = ?
    `).bind(correctCount, attemptId).run();
    const loaded = await loadAttempt(db, String(student.id), todayDateKey, attemptId);
    return { data: { ...loaded, completed: false } } as const;
  }

  const completedAt = new Date().toISOString();
  await db.prepare(`
    UPDATE attendance_attempts
    SET status = 'COMPLETED', correct_count = ?, completed_at = COALESCE(completed_at, ?)
    WHERE id = ?
  `).bind(correctCount, completedAt, attemptId).run();

  const reward = await awardAttendance(db, String(student.id), username, todayDateKey);
  const loaded = await loadAttempt(db, String(student.id), todayDateKey, attemptId);
  return {
    data: {
      ...loaded,
      completed: true,
      ...reward,
    },
  } as const;
};
