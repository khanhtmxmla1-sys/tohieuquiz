import { generateId } from '../utils/response';
import { COIN_AWARD_MAX_RECIPIENTS } from '../../../shared/coin-awards.contract';

export type StudentRewardSourceType =
  | 'QUIZ_RESULT'
  | 'DAILY_ATTENDANCE'
  | 'DAILY_MISSION'
  | 'DAILY_CHEST'
  | 'WEEKLY_QUEST'
  | 'WEEKLY_LEADERBOARD'
  | 'LIVE_EXAM'
  | 'GIFT_PURCHASE'
  | 'GIFT_REFUND'
  | 'PET_SHOP_PURCHASE'
  | 'MANUAL_AWARD'
  | 'MANUAL_AWARD_REVERSAL';

export interface StudentRewardMutation {
  studentId: string;
  username: string;
  sourceType: StudentRewardSourceType;
  sourceKey: string;
  rewardType: string;
  coinsDelta: number;
  expDelta: number;
  payload?: Record<string, unknown>;
  extraStatements?: D1PreparedStatement[];
}

export interface StudentRewardLedgerRow {
  id: string;
  student_id: string;
  source_type: string;
  source_key: string;
  reward_type: string;
  coins_delta: number;
  exp_delta: number;
  payload_json: string;
  created_at: string;
}

export interface StudentRewardWalletSnapshot {
  coins: number;
  totalExp: number;
  level: number;
  exp: number;
  expToNext: number;
  mood: string;
}

export interface StudentRewardApplyResult {
  alreadyClaimed: boolean;
  ledger: StudentRewardLedgerRow;
  wallet: StudentRewardWalletSnapshot;
}

interface PreparedStudentRewardRow {
  id: string;
  studentId: string;
  username: string;
  sourceType: StudentRewardSourceType;
  sourceKey: string;
  rewardType: string;
  coinsDelta: number;
  expDelta: number;
  payloadJson: string;
  createdAt: string;
}

export interface PreparedRewardBatch {
  rows: ReadonlyArray<PreparedStudentRewardRow>;
  statements: D1PreparedStatement[];
}

const normalizeInteger = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('Reward delta must be finite');
  return Math.trunc(value);
};

const loadLedger = (
  db: D1Database,
  studentId: string,
  sourceType: string,
  sourceKey: string,
) => db.prepare(`
  SELECT id, student_id, source_type, source_key, reward_type,
         coins_delta, exp_delta, payload_json, created_at
  FROM student_reward_ledger
  WHERE student_id = ? AND source_type = ? AND source_key = ?
  LIMIT 1
`).bind(studentId, sourceType, sourceKey).first<StudentRewardLedgerRow>();

export const loadStudentRewardWallet = async (
  db: D1Database,
  studentId: string,
): Promise<StudentRewardWalletSnapshot> => {
  const row = await db.prepare(`
    SELECT s.coins,
           COALESCE(p.total_exp, 0) AS total_exp,
           COALESCE(p.level, 1) AS level,
           COALESCE(p.exp, 0) AS exp,
           COALESCE(p.exp_to_next, 100) AS exp_to_next,
           COALESCE(p.mood, 'happy') AS mood
    FROM students s
    LEFT JOIN user_pets p ON p.username = s.username
    WHERE s.id = ?
    LIMIT 1
  `).bind(studentId).first<any>();

  if (!row) throw new Error('Student not found');
  return {
    coins: Number(row.coins) || 0,
    totalExp: Math.max(0, Number(row.total_exp) || 0),
    level: Math.max(1, Number(row.level) || 1),
    exp: Math.max(0, Number(row.exp) || 0),
    expToNext: Math.max(1, Number(row.exp_to_next) || 100),
    mood: String(row.mood || 'happy'),
  };
};

const buildAtomicPetExpUpdate = (
  db: D1Database,
  username: string,
  expDelta: number,
  now: string,
): D1PreparedStatement => db.prepare(`
  UPDATE user_pets
  SET level = (
        WITH RECURSIVE levels(level, cumulative, threshold) AS (
          VALUES(1, 0, 100)
          UNION ALL
          SELECT level + 1, cumulative + threshold, 100 + level * 20
          FROM levels
          WHERE cumulative + threshold <= total_exp + ?
        )
        SELECT level FROM levels ORDER BY level DESC LIMIT 1
      ),
      exp = total_exp + ? - (
        WITH RECURSIVE levels(level, cumulative, threshold) AS (
          VALUES(1, 0, 100)
          UNION ALL
          SELECT level + 1, cumulative + threshold, 100 + level * 20
          FROM levels
          WHERE cumulative + threshold <= total_exp + ?
        )
        SELECT cumulative FROM levels ORDER BY level DESC LIMIT 1
      ),
      exp_to_next = (
        WITH RECURSIVE levels(level, cumulative, threshold) AS (
          VALUES(1, 0, 100)
          UNION ALL
          SELECT level + 1, cumulative + threshold, 100 + level * 20
          FROM levels
          WHERE cumulative + threshold <= total_exp + ?
        )
        SELECT threshold FROM levels ORDER BY level DESC LIMIT 1
      ),
      total_exp = total_exp + ?,
      mood = 'excited',
      last_active = ?
  WHERE username = ?
`).bind(expDelta, expDelta, expDelta, expDelta, expDelta, now, username);

export const applyStudentReward = async (
  db: D1Database,
  input: StudentRewardMutation,
): Promise<StudentRewardApplyResult> => {
  const studentId = String(input.studentId || '').trim();
  const username = String(input.username || '').trim();
  const sourceKey = String(input.sourceKey || '').trim();
  if (!studentId || !username || !sourceKey) throw new Error('Missing canonical reward identity');

  const coinsDelta = normalizeInteger(input.coinsDelta);
  const expDelta = normalizeInteger(input.expDelta);
  if (expDelta < 0) throw new Error('EXP delta cannot be negative');

  const existing = await loadLedger(db, studentId, input.sourceType, sourceKey);
  if (existing) {
    return {
      alreadyClaimed: true,
      ledger: existing,
      wallet: await loadStudentRewardWallet(db, studentId),
    };
  }

  const now = new Date().toISOString();
  const ledgerId = generateId('reward');
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO student_reward_ledger (
        id, student_id, source_type, source_key, reward_type,
        coins_delta, exp_delta, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      ledgerId,
      studentId,
      input.sourceType,
      sourceKey,
      input.rewardType,
      coinsDelta,
      expDelta,
      JSON.stringify(input.payload || {}),
      now,
    ),
    db.prepare('UPDATE students SET coins = coins + ? WHERE id = ?')
      .bind(coinsDelta, studentId),
  ];

  if (expDelta > 0) {
    statements.push(
      db.prepare(`
        INSERT OR IGNORE INTO user_pets (
          username, pet_id, pet_name, level, exp, exp_to_next, total_exp,
          mood, items, last_active
        ) VALUES (?, 'cat_01', 'Mèo Con', 1, 0, 100, 0, 'happy', '[]', ?)
      `).bind(username, now),
      buildAtomicPetExpUpdate(db, username, expDelta, now),
    );
  }

  statements.push(...(input.extraStatements || []));

  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await loadLedger(db, studentId, input.sourceType, sourceKey);
    if (raced) {
      return {
        alreadyClaimed: true,
        ledger: raced,
        wallet: await loadStudentRewardWallet(db, studentId),
      };
    }
    throw error;
  }

  const inserted = await loadLedger(db, studentId, input.sourceType, sourceKey);
  if (!inserted) throw new Error('Reward ledger receipt missing after commit');
  return {
    alreadyClaimed: false,
    ledger: inserted,
    wallet: await loadStudentRewardWallet(db, studentId),
  };
};

/**
 * Builds the two statements required to apply a bounded reward batch. The
 * caller owns the surrounding transaction (normally one D1 `batch` call), so
 * the ledger insert and wallet update cannot be observed separately.
 */
export const prepareStudentRewardBatch = (
  db: D1Database,
  mutations: StudentRewardMutation[],
): PreparedRewardBatch => {
  if (mutations.length < 1 || mutations.length > COIN_AWARD_MAX_RECIPIENTS) {
    throw new Error(`Reward batch must contain between 1 and ${COIN_AWARD_MAX_RECIPIENTS} mutations`);
  }

  const seen = new Set<string>();
  const seenStudents = new Set<string>();
  const createdAt = new Date().toISOString();
  const rows = mutations.map((mutation) => {
    const studentId = String(mutation.studentId || '').trim();
    const username = String(mutation.username || '').trim();
    const sourceKey = String(mutation.sourceKey || '').trim();
    const rewardType = String(mutation.rewardType || '').trim();
    if (!studentId || !username || !sourceKey || !rewardType) {
      throw new Error('Missing canonical reward identity');
    }
    if (!mutation.sourceType) throw new Error('Missing reward source type');
    if (seenStudents.has(studentId)) throw new Error('Duplicate reward recipient');
    seenStudents.add(studentId);

    const uniqueKey = [studentId, mutation.sourceType, sourceKey].join(':');
    if (seen.has(uniqueKey)) throw new Error('Duplicate reward mutation');
    seen.add(uniqueKey);

    const coinsDelta = normalizeInteger(mutation.coinsDelta);
    const expDelta = normalizeInteger(mutation.expDelta);
    if (expDelta < 0) throw new Error('EXP delta cannot be negative');

    let payloadJson: string;
    try {
      payloadJson = JSON.stringify(mutation.payload || {});
    } catch {
      throw new Error('Reward payload must be JSON serializable');
    }
    if (!payloadJson) throw new Error('Reward payload must be JSON serializable');

    return {
      id: generateId('reward'),
      studentId,
      username,
      sourceType: mutation.sourceType,
      sourceKey,
      rewardType,
      coinsDelta,
      expDelta,
      payloadJson,
      createdAt,
    } satisfies PreparedStudentRewardRow;
  });

  const serializedRows = JSON.stringify(rows);
  const ledgerInsert = db.prepare(`
    INSERT INTO student_reward_ledger (
      id, student_id, source_type, source_key, reward_type,
      coins_delta, exp_delta, payload_json, created_at
    )
    SELECT
      json_extract(value, '$.id'),
      json_extract(value, '$.studentId'),
      json_extract(value, '$.sourceType'),
      json_extract(value, '$.sourceKey'),
      json_extract(value, '$.rewardType'),
      CAST(json_extract(value, '$.coinsDelta') AS INTEGER),
      CAST(json_extract(value, '$.expDelta') AS INTEGER),
      json_extract(value, '$.payloadJson'),
      json_extract(value, '$.createdAt')
    FROM json_each(?)
  `).bind(serializedRows);

  const walletUpdate = db.prepare(`
    UPDATE students
    SET coins = coins + (
      SELECT COALESCE(SUM(CAST(json_extract(value, '$.coinsDelta') AS INTEGER)), 0)
      FROM json_each(?)
      WHERE json_extract(value, '$.studentId') = students.id
    )
    WHERE id IN (
      SELECT json_extract(value, '$.studentId')
      FROM json_each(?)
    )
  `).bind(serializedRows, serializedRows);

  return {
    rows,
    statements: [ledgerInsert, walletUpdate],
  };
};

export const parseRewardPayload = <T extends Record<string, unknown>>(
  ledger: StudentRewardLedgerRow,
  fallback: T,
): T => {
  try {
    const parsed = JSON.parse(ledger.payload_json || '{}');
    return parsed && typeof parsed === 'object' ? parsed as T : fallback;
  } catch {
    return fallback;
  }
};
