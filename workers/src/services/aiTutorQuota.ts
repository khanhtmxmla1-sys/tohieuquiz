import type { JWTPayload } from '../utils/jwt';

export interface AiTutorQuotaInput {
  requestId: string;
  username: string;
  role: JWTPayload['role'];
  resultId: string;
}

export interface AiTutorQuotaReservation {
  allowed: boolean;
  reused: boolean;
  remaining: number;
}

export const getAiTutorDailyLimit = (role: JWTPayload['role']): number => {
  if (role === 'admin') return 100;
  if (role === 'teacher') return 30;
  return 5;
};

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

export async function reserveAiTutorQuota(
  db: D1Database,
  input: AiTutorQuotaInput,
): Promise<AiTutorQuotaReservation> {
  const existing = await db.prepare(`
    SELECT reservation_key, status
    FROM ai_tutor_reservations
    WHERE reservation_key = ?
    LIMIT 1
  `).bind(input.requestId).first<{ reservation_key: string; status: string }>();
  if (existing) {
    return { allowed: existing.status !== 'FAILED', reused: true, remaining: 0 };
  }

  const usageDate = todayUtc();
  const limit = getAiTutorDailyLimit(input.role);
  await db.prepare(`
    INSERT OR IGNORE INTO ai_tutor_daily_usage (username, usage_date, role, used_count)
    VALUES (?, ?, ?, 0)
  `).bind(input.username, usageDate, input.role, 0).run();

  const increment = await db.prepare(`
    UPDATE ai_tutor_daily_usage
    SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE username = ? AND usage_date = ? AND used_count < ?
  `).bind(input.username, usageDate, limit).run();
  const changes = Number(increment.meta?.changes ?? 0);
  if (changes < 1) return { allowed: false, reused: false, remaining: 0 };

  try {
    await db.prepare(`
      INSERT INTO ai_tutor_reservations
        (reservation_key, username, usage_date, result_id, status)
      VALUES (?, ?, ?, ?, 'RESERVED')
    `).bind(input.requestId, input.username, usageDate, input.resultId).run();
  } catch (error) {
    await db.prepare(`
      UPDATE ai_tutor_daily_usage
      SET used_count = MAX(used_count - 1, 0), updated_at = CURRENT_TIMESTAMP
      WHERE username = ? AND usage_date = ?
    `).bind(input.username, usageDate).run();
    const raced = await db.prepare('SELECT reservation_key, status FROM ai_tutor_reservations WHERE reservation_key = ? LIMIT 1')
      .bind(input.requestId)
      .first<{ reservation_key: string; status: string }>();
    if (raced) return { allowed: raced.status !== 'FAILED', reused: true, remaining: 0 };
    throw error;
  }

  const usage = await db.prepare('SELECT used_count FROM ai_tutor_daily_usage WHERE username = ? AND usage_date = ? LIMIT 1')
    .bind(input.username, usageDate)
    .first<{ used_count: number }>();
  return { allowed: true, reused: false, remaining: Math.max(0, limit - Number(usage?.used_count ?? 1)) };
}

export async function completeAiTutorQuota(db: D1Database, requestId: string): Promise<void> {
  await db.prepare(`
    UPDATE ai_tutor_reservations SET status = 'SUCCEEDED', updated_at = CURRENT_TIMESTAMP
    WHERE reservation_key = ? AND status = 'RESERVED'
  `).bind(requestId).run();
}

export async function releaseAiTutorQuota(db: D1Database, requestId: string): Promise<void> {
  const reservation = await db.prepare(`
    SELECT username, usage_date, status FROM ai_tutor_reservations
    WHERE reservation_key = ? LIMIT 1
  `).bind(requestId).first<{ username: string; usage_date: string; status: string }>();
  if (!reservation || reservation.status !== 'RESERVED') return;

  const statements = [
    db.prepare(`UPDATE ai_tutor_reservations SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE reservation_key = ?`).bind(requestId),
    db.prepare(`UPDATE ai_tutor_daily_usage SET used_count = MAX(used_count - 1, 0), updated_at = CURRENT_TIMESTAMP WHERE username = ? AND usage_date = ?`).bind(reservation.username, reservation.usage_date),
  ];
  if (typeof db.batch === 'function') await db.batch(statements);
  else {
    await statements[0].run();
    await statements[1].run();
  }
}
