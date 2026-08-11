// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getWeekUtcRange } from '../workers/src/gameLoop/dateKeys';
import {
  getRewardReconciliationReport,
  getSuspiciousRewardGrowthReport,
  rebuildCurrentWeekProgress,
} from '../workers/src/gamification/rewardSecurityMaintenance';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly rows: any[]) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async all<T>() { return { results: this.rows as T[] }; }
}

class FakeDb {
  prepared: Statement[] = [];
  batched: Statement[] = [];
  constructor(private readonly resolver: (sql: string) => any[]) {}
  prepare(sql: string) {
    const statement = new Statement(sql, this.resolver(sql));
    this.prepared.push(statement);
    return statement;
  }
  async batch(statements: Statement[]) {
    this.batched = statements;
    return [];
  }
}

describe('reward security maintenance', () => {
  it('rebuilds only the current Hanoi week from canonical saved results', async () => {
    const now = new Date('2026-08-11T04:00:00.000Z');
    const db = new FakeDb((sql) => sql.includes('FROM results r') ? [
      {
        id: 'result-1', student_id: 'student-a', class_id: 'class-a', quiz_id: 'quiz-1',
        score: 8, correct_count: 8, total_questions: 10, username: 'student-a', category: 'Tiếng Anh',
        submitted_at: '2026-08-10T01:00:00.000Z',
      },
      {
        id: 'result-2', student_id: 'student-b', class_id: 'class-a', quiz_id: 'quiz-2',
        score: 10, correct_count: 10, total_questions: 10, username: 'student-b', category: 'Toán',
        submitted_at: '2026-08-10T02:00:00.000Z',
      },
    ] : []);

    const result = await rebuildCurrentWeekProgress(db as any, now);
    const range = getWeekUtcRange(result.weekKey);
    const query = db.prepared.find(statement => statement.sql.includes('FROM results r'))!;

    expect(query.bindings).toEqual([range.startIso, range.endIsoExclusive]);
    expect(result).toMatchObject({
      scanned: 2,
      recorded: 2,
      alreadyRecorded: 0,
      rebuiltStudents: 2,
      rebuiltDays: 2,
    });
    expect(db.batched.length).toBeGreaterThan(4);
  });

  it('reports reconciliation drift without issuing any write statement', async () => {
    const db = new FakeDb((sql) => sql.includes('student_reward_reconciliation') ? [
      { student_id: 'student-a', username: 'student-a', wallet_coins: 130, ledger_coins: 120, difference: 10 },
    ] : []);

    const rows = await getRewardReconciliationReport(db as any, 50);
    expect(rows).toEqual([{
      studentId: 'student-a', username: 'student-a', walletCoins: 130, ledgerCoins: 120, difference: 10,
    }]);
    expect(db.prepared.every(statement => /^\s*SELECT/i.test(statement.sql))).toBe(true);
  });

  it('reports only thresholded positive growth from immutable ledger', async () => {
    const db = new FakeDb((sql) => sql.includes('FROM student_reward_ledger') ? [
      {
        student_id: 'student-a', username: 'student-a', wallet_coins: 2500,
        coins_growth: 1800, reward_events: 12, largest_single_delta: 500,
      },
    ] : []);
    const rows = await getSuspiciousRewardGrowthReport(db as any, '2026-08-10T04:00:00.000Z', 1000, 20);
    const query = db.prepared[0];

    expect(query.bindings).toEqual(['2026-08-10T04:00:00.000Z', 1000, 20]);
    expect(query.sql).toContain("l.source_type <> 'BALANCE_OPENING'");
    expect(rows[0]).toMatchObject({ studentId: 'student-a', coinsGrowth: 1800, largestSingleDelta: 500 });
  });
});