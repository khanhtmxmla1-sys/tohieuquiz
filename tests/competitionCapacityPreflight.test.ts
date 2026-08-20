// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationUrl = new URL('../workers/migrations/0071_live_exam_capacity_profiles.sql', import.meta.url);
const rollbackUrl = new URL('../workers/migrations/rollback/0071_live_exam_capacity_profiles.rollback.sql', import.meta.url);

let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

async function loadCapacityService() {
  try {
    return await import('../workers/src/competition/capacityService');
  } catch {
    return null;
  }
}

const room = (scheduledAt: string, assignedStudents: number, overrides: Partial<{
  durationMinutes: number;
  checkInLeadMinutes: number;
  closeDrainMinutes: number;
}> = {}) => ({
  scheduledAt,
  assignedStudents,
  durationMinutes: overrides.durationMinutes ?? 45,
  checkInLeadMinutes: overrides.checkInLeadMinutes ?? 15,
  closeDrainMinutes: overrides.closeDrainMinutes ?? 10,
});

describe('Competition certified capacity preflight', () => {
  it('counts overlapping same-time rooms against one aggregate peak', async () => {
    const capacity = await loadCapacityService();
    expect(capacity).not.toBeNull();
    if (!capacity) return;

    expect(capacity.calculatePeakConcurrency([
      room('2027-05-10T01:00:00.000Z', 40),
      room('2027-05-10T01:00:00.000Z', 30),
      room('2027-05-10T01:00:00.000Z', 30),
    ])).toBe(100);
  });

  it('keeps non-overlapping shifts at the larger shift size and ends before starts on a shared boundary', async () => {
    const capacity = await loadCapacityService();
    expect(capacity).not.toBeNull();
    if (!capacity) return;

    expect(capacity.calculatePeakConcurrency([
      room('2027-05-10T01:00:00.000Z', 50, { durationMinutes: 60, checkInLeadMinutes: 0, closeDrainMinutes: 0 }),
      room('2027-05-10T02:00:00.000Z', 50, { durationMinutes: 60, checkInLeadMinutes: 0, closeDrainMinutes: 0 }),
    ])).toBe(50);
  });

  it('blocks readiness when no certified profile exists', async () => {
    const capacity = await loadCapacityService();
    expect(capacity).not.toBeNull();
    if (!capacity) return;

    expect(capacity.evaluateCapacityPreflight([
      room('2027-05-10T01:00:00.000Z', 40),
    ], null)).toEqual({
      status: 'PREFLIGHT_BLOCKED',
      reason: 'CAPACITY_UNVERIFIED',
      plannedConcurrency: 40,
      certifiedConcurrentStudents: null,
      capacityProfileId: null,
    });
  });

  it('persists only gate-passing certified capacity profiles in a forward migration', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    expect(existsSync(rollbackUrl)).toBe(true);
    if (!existsSync(migrationUrl) || !existsSync(rollbackUrl)) return;

    db = new DatabaseSync(':memory:');
    db.exec(readFileSync(migrationUrl, 'utf8'));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='live_exam_capacity_profiles'").get()).toEqual({
      name: 'live_exam_capacity_profiles',
    });
    expect(() => db!.prepare(`
      INSERT INTO live_exam_capacity_profiles (
        id, benchmark_run_id, build_sha, runtime_config_version, polling_profile_version,
        certified_concurrent_students, status_p95_ms, submit_p95_ms, lost_answers,
        duplicate_failures, d1_overload, app_5xx, network_errors, passed_at, created_at
      ) VALUES ('profile-bad', 'run-bad', 'abc123', 'cfg-1', 'poll-1', 100, 400, 1500, 1, 0, 0, 0, 0,
        '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')
    `).run()).toThrow();

    db.exec(readFileSync(rollbackUrl, 'utf8'));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='live_exam_capacity_profiles'").get()).toBeUndefined();
  });
});
