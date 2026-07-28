import { describe, expect, it, vi } from 'vitest';
import { getAiTutorDailyLimit, reserveAiTutorQuota, releaseAiTutorQuota } from '../workers/src/services/aiTutorQuota';

describe('AI Tutor quota', () => {
  it('uses role-specific daily limits', () => {
    expect(getAiTutorDailyLimit('student')).toBe(5);
    expect(getAiTutorDailyLimit('teacher')).toBe(30);
    expect(getAiTutorDailyLimit('admin')).toBe(100);
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
