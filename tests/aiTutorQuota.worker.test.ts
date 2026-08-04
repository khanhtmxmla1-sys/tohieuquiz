import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAiTutorDailyLimit, reserveAiTutorQuota, releaseAiTutorQuota } from '../workers/src/services/aiTutorQuota';

describe('AI Tutor quota', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses role-specific daily limits', () => {
    expect(getAiTutorDailyLimit('student')).toBe(5);
    expect(getAiTutorDailyLimit('teacher')).toBe(30);
    expect(getAiTutorDailyLimit('admin')).toBe(100);
  });

  it('changes the usage date exactly at midnight in Hanoi', async () => {
    const reserveAt = async (instant: string): Promise<string> => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));
      const usageDates: string[] = [];
      const db = {
        prepare: vi.fn((sql: string) => ({
          bind: (...values: unknown[]) => {
            if (sql.includes('INSERT OR IGNORE INTO ai_tutor_daily_usage')) {
              usageDates.push(String(values[1]));
            }
            return {
              first: vi.fn(async () => {
                if (sql.includes('FROM ai_tutor_reservations')) return null;
                if (sql.includes('SELECT used_count')) return { used_count: 1 };
                return null;
              }),
              run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
            };
          },
        })),
      };

      await reserveAiTutorQuota(db as never, {
        requestId: `req-${instant}`,
        username: 'student-a',
        role: 'student',
        resultId: 'result-1',
      });
      return usageDates[0];
    };

    await expect(reserveAt('2026-08-04T16:59:59.999Z')).resolves.toBe('2026-08-04');
    await expect(reserveAt('2026-08-04T17:00:00.000Z')).resolves.toBe('2026-08-05');
  });

  it('returns the same reservation for an idempotent request key', async () => {
    const existing = { reservation_key: 'req-1', status: 'RESERVED' };
    const first = vi.fn().mockResolvedValue(existing);
    const bind = vi.fn(() => ({ first, run: vi.fn().mockResolvedValue({ success: true }) }));
    const db = { prepare: vi.fn(() => ({ bind })) };
    const result = await reserveAiTutorQuota(db as never, {
      requestId: 'req-1', username: 'student-a', role: 'student', resultId: 'result-1',
    });
    expect(result.allowed).toBe(true);
    expect(result.reused).toBe(true);
  });

  it('releases a reserved unit after upstream failure', async () => {
    const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue({ username: 'student-a', usage_date: '2026-07-28', status: 'RESERVED' });
    const bind = vi.fn(() => ({ run, first }));
    const db = { prepare: vi.fn(() => ({ bind })), batch: vi.fn().mockResolvedValue([]) };
    await expect(releaseAiTutorQuota(db as never, 'req-1')).resolves.toBeUndefined();
    expect(db.batch).toHaveBeenCalledTimes(1);
  });
});
