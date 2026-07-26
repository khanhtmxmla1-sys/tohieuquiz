// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createParentPortalEventLogger,
  sanitizeParentPortalLogMetadata,
} from '../workers/src/parentPortal/observability';
import { createParentNotification } from '../workers/src/parentPortal/notificationService';

class Statement {
  constructor(private readonly db: FakeDb) {}
  bind(...bindings: unknown[]) { this.db.bindings = bindings; return this; }
  async run() { return { meta: { changes: 1 } }; }
}
class FakeDb {
  bindings: unknown[] = [];
  prepare() { return new Statement(this); }
}

describe('Parent Portal safe observability', () => {
  it('removes secret-like keys recursively before writing logs', () => {
    const sanitized = sanitizeParentPortalLogMetadata({
      linkId: 'link-1',
      studentId: 'student-1',
      token: 'raw-token-value',
      pin: '123456',
      nested: {
        accessCode: 'ABCDEFG234',
        cookie: 'parent_auth_token=value',
        safe: 'ok',
      },
    });
    expect(sanitized).toEqual({
      linkId: 'link-1',
      studentId: 'student-1',
      nested: { safe: 'ok' },
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/raw-token-value|123456|ABCDEFG234|parent_auth_token/i);
  });

  it('writes structured event names and safe identifiers only', () => {
    const sink = { info: vi.fn(), warn: vi.fn() };
    const logger = createParentPortalEventLogger(sink);
    logger.info('link_created', {
      linkId: 'link-1',
      studentId: 'student-1',
      actor: 'teacher-a',
      token: 'must-not-log',
    });
    logger.warn('login_failed', { reason: 'invalid_credentials', pin: '654321' });

    expect(sink.info).toHaveBeenCalledWith('[ParentPortal] link_created', {
      linkId: 'link-1', studentId: 'student-1', actor: 'teacher-a',
    });
    expect(sink.warn).toHaveBeenCalledWith('[ParentPortal] login_failed', {
      reason: 'invalid_credentials',
    });
    expect(JSON.stringify([sink.info.mock.calls, sink.warn.mock.calls])).not.toMatch(/must-not-log|654321/);
  });

  it('logs notification creation without payload or credential data', async () => {
    const sink = { info: vi.fn(), warn: vi.fn() };
    const logger = createParentPortalEventLogger(sink);
    await createParentNotification(new FakeDb() as any, {
      studentId: 'student-1',
      kind: 'quiz_result',
      sourceType: 'result',
      sourceId: 'result-1',
      title: 'Có kết quả mới',
      body: 'Điểm 8',
      payload: { answers: { q1: 'A' }, pin: '123456' },
      publishedAt: '2026-07-22T00:00:00.000Z',
    }, logger);

    expect(sink.info).toHaveBeenCalledWith('[ParentPortal] notification_created', expect.objectContaining({
      kind: 'quiz_result', sourceType: 'result', sourceId: 'result-1', studentId: 'student-1',
    }));
    expect(JSON.stringify(sink.info.mock.calls)).not.toMatch(/answers|123456/);
  });

  it('wires the required events into route and service code', () => {
    const teacher = readFileSync('workers/src/routes/parentPortal/teacherLinkRoutes.ts', 'utf8');
    const auth = readFileSync('workers/src/routes/parentPortal/authRoutes.ts', 'utf8');
    const notifications = readFileSync('workers/src/parentPortal/notificationService.ts', 'utf8');
    expect(teacher).toContain("logger?.info('link_created'");
    expect(auth).toContain("'activated'");
    expect(auth).toContain("'login_success'");
    expect(auth).toContain("logger?.warn('login_failed'");
    expect(notifications).toContain("logger.info('notification_created'");
  });
});
