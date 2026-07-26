import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleGamificationRoutes } from '../workers/src/routes/gamification';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: RewardDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { return { results: [] as T[] }; }
  async run() { return this.db.execute(this.sql, this.bindings); }
}

class RewardDatabase {
  coins = 100;
  pet: any = { level: 1, exp: 0, exp_to_next: 100, mood: 'happy' };
  result: any = {
    id: 42,
    student_name: 'Nguyễn Văn An',
    class_name: '5A',
    score: 8,
    correct_count: 8,
    total_questions: 10,
  };
  receipt: any = null;
  failBatchAtIndex: number | null = null;

  prepare(sql: string) { return new Statement(sql, this); }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM reward_receipts')) return this.receipt;
    if (sql.includes('FROM results')) {
      return String(bindings[0]) === String(this.result?.id) ? this.result : null;
    }
    if (sql.includes('LEFT JOIN classes')) {
      return { full_name: 'Nguyễn Văn An', class_name: '5A', coins: this.coins };
    }
    if (sql.includes('SELECT * FROM user_pets')) return this.pet ? { ...this.pet } : null;
    return null;
  }

  execute(sql: string, bindings: unknown[]) {
    if (sql.includes('INSERT INTO reward_receipts')) {
      if (this.receipt) throw new Error('UNIQUE constraint failed');
      this.receipt = {
        reward_exp: Number(bindings[4]),
        reward_coins: Number(bindings[5]),
        new_level: Number(bindings[6]),
        new_exp: Number(bindings[7]),
        new_exp_to_next: Number(bindings[8]),
        new_coins: Number(bindings[9]),
        leveled_up: Number(bindings[10]),
        mood: String(bindings[11]),
        created_at: bindings[12],
      };
    } else if (sql.includes('UPDATE students SET coins = ?')) {
      this.coins = Number(bindings[0]);
    } else if (sql.includes('UPDATE user_pets')) {
      this.pet = {
        level: Number(bindings[0]),
        exp: Number(bindings[1]),
        exp_to_next: Number(bindings[2]),
        mood: String(bindings[3]),
      };
    } else if (sql.includes('INSERT INTO user_pets')) {
      this.pet = {
        level: Number(bindings[3]),
        exp: Number(bindings[4]),
        exp_to_next: Number(bindings[5]),
        mood: String(bindings[6]),
      };
    }
    return { success: true, meta: { changes: 1 } };
  }

  async batch(statements: Statement[]) {
    const snapshot = {
      coins: this.coins,
      pet: this.pet ? { ...this.pet } : null,
      receipt: this.receipt ? { ...this.receipt } : null,
    };

    try {
      return statements.map((statement, index) => {
        if (this.failBatchAtIndex === index) throw new Error('Simulated transactional failure');
        return this.execute(statement.sql, statement.bindings);
      });
    } catch (error) {
      this.coins = snapshot.coins;
      this.pet = snapshot.pet;
      this.receipt = snapshot.receipt;
      throw error;
    }
  }
}

const env = (db: RewardDatabase) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const rewardRequest = (resultId: string) => new Request('https://test/api/game-state/result-reward', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ resultId }),
});
const claim = (db: RewardDatabase, resultId = '42') => handleGamificationRoutes(
  rewardRequest(resultId),
  env(db),
  '/api/game-state/result-reward',
  'POST',
);

describe('result reward claim', () => {
  beforeEach(() => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
  });

  it('calculates and applies the saved result reward in one batch', async () => {
    const db = new RewardDatabase();
    const response = await claim(db);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      awardedExp: 60,
      awardedCoins: 15,
      alreadyClaimed: false,
      newLevel: 1,
      newExp: 60,
      newExpToNext: 100,
      newCoins: 115,
    });
    expect(db.receipt).toMatchObject({ new_exp: 60, new_coins: 115 });
  });

  it('returns the stored receipt snapshot without applying the reward twice', async () => {
    const db = new RewardDatabase();
    await claim(db);
    db.coins = 999;
    db.pet.exp = 99;

    const secondResponse = await claim(db);
    const payload = await secondResponse.json() as any;

    expect(payload.data).toMatchObject({
      alreadyClaimed: true,
      awardedExp: 60,
      awardedCoins: 15,
      newExp: 60,
      newCoins: 115,
    });
    expect(db.coins).toBe(999);
    expect(db.pet.exp).toBe(99);
  });

  it('rolls back a partial batch so retry can safely award later', async () => {
    const db = new RewardDatabase();
    db.failBatchAtIndex = 1;

    const failedResponse = await claim(db);
    expect(failedResponse.status).toBe(500);
    expect(db.receipt).toBeNull();
    expect(db.coins).toBe(100);
    expect(db.pet.exp).toBe(0);

    db.failBatchAtIndex = null;
    const retryResponse = await claim(db);
    expect(retryResponse.status).toBe(200);
    expect(db.coins).toBe(115);
    expect(db.pet.exp).toBe(60);
  });

  it('creates a default pet inside the same transaction when needed', async () => {
    const db = new RewardDatabase();
    db.pet = null;

    const response = await claim(db);
    expect(response.status).toBe(200);
    expect(db.pet).toMatchObject({ level: 1, exp: 60, exp_to_next: 100, mood: 'excited' });
  });

  it('rejects a result owned by another student', async () => {
    const db = new RewardDatabase();
    db.result.student_name = 'Học sinh khác';

    const response = await claim(db);
    expect(response.status).toBe(403);
  });

  it('returns 404 when the saved result does not exist', async () => {
    const db = new RewardDatabase();
    db.result = null;

    const response = await claim(db, 'missing');
    expect(response.status).toBe(404);
  });
});
