// @vitest-environment node

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  REPAIR_CONFIRMATION,
  SMOKE_FIXTURE,
  buildRepairSql,
  normalizeOptions,
  validateSnapshot,
} = require('../workers/scripts/repair-production-smoke-fixtures.cjs');

const healthySnapshot = {
  student: {
    id: 's-ca79f38f',
    username: 'smoke.student',
    class_id: 'c-production-smoke',
    archived_at: null,
  },
  smokeClass: {
    id: 'c-production-smoke',
    name: 'Lớp Smoke Production',
    teacher_username: 'smoke.teacher',
    archived_at: null,
  },
  teacher: {
    username: 'smoke.teacher',
    role: 'teacher',
    status: 'ACTIVE',
  },
  activeParentLinks: 1,
};

describe('production smoke fixture repair safety', () => {
  it('defaults to dry-run and requires exact confirmations for production writes', () => {
    expect(normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
    })).toMatchObject({ mode: 'remote', write: false });

    expect(() => normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
      write: true,
    })).toThrow(/confirm-repair/i);

    expect(normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
      confirmRepair: REPAIR_CONFIRMATION,
      write: true,
    })).toMatchObject({ mode: 'remote', write: true });
  });

  it('only considers the exact reserved production smoke identities repairable', () => {
    expect(validateSnapshot(healthySnapshot)).toMatchObject({ state: 'healthy' });
    expect(validateSnapshot({
      ...healthySnapshot,
      student: { ...healthySnapshot.student, archived_at: '2026-08-07T15:13:15.895Z' },
      smokeClass: { ...healthySnapshot.smokeClass, archived_at: '2026-08-07T15:13:15.895Z' },
    })).toMatchObject({ state: 'repairable' });

    expect(() => validateSnapshot({
      ...healthySnapshot,
      student: { ...healthySnapshot.student, id: 's-wrong' },
    })).toThrow(/student identity/i);
    expect(() => validateSnapshot({
      ...healthySnapshot,
      smokeClass: { ...healthySnapshot.smokeClass, teacher_username: 'other.teacher' },
    })).toThrow(/class identity/i);
    expect(() => validateSnapshot({ ...healthySnapshot, activeParentLinks: 0 })).toThrow(/parent link/i);
  });

  it('builds a repair that only unarchives the exact smoke class and student and records an audit event', () => {
    const sql = buildRepairSql({ requestId: 'smoke-repair-test', now: '2026-08-08T00:30:00.000Z' });
    expect(sql).toContain(`UPDATE classes SET archived_at=NULL WHERE id='${SMOKE_FIXTURE.classId}'`);
    expect(sql).toContain(`UPDATE students SET archived_at=NULL WHERE id='${SMOKE_FIXTURE.studentId}'`);
    expect(sql).toContain('action, target_type, target_id');
    expect(sql).toContain('PRODUCTION_SMOKE_FIXTURES_REPAIRED');
    expect(sql).not.toMatch(/password_hash\s*=|pin_hash\s*=/i);
  });
});
