// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';
import { createSqliteD1 } from './helpers/sqliteD1';
import { createParentNotification } from '../workers/src/parentPortal/notificationService';
import { createNotification } from '../workers/src/services/notificationWriter';

const renderCertificateMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/services/certificateRenderer', () => ({
  renderCertificate: renderCertificateMock,
}));

import { finalizeCertificateBatch, processBatch } from '../workers/src/services/certificateBatchProcessor';

class ProcessorStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: ProcessorDB) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  first<T>() {
    if (this.sql.includes('certificate_templates')) {
      return Promise.resolve({
        bg_image_r2_key: 'templates/bg.png',
        fields_config: JSON.stringify([
          { key: 'student_name', x: 100, y: 50, fontFamily: 'Great Vibes' },
          { key: 'quiz_title', x: 100, y: 100, prefix: 'Đã hoàn thành xuất sắc ' },
          { key: 'date', x: 100, y: 200, fontStyle: 'normal', prefix: 'Mường La, ngày ', format: 'vi-long-date' },
        ]),
        canvas_width: 1270,
        canvas_height: 698,
      } as T);
    }
    if (this.sql.includes('FROM certificate_batches')) {
      return Promise.resolve({ teacher_id: 'teacher-1' } as T);
    }
    return Promise.resolve(null);
  }
  run() { this.db.runs.push(this); return Promise.resolve({ success: true }); }

  all<T>() {
    if (this.sql.includes("FROM certificates") && this.sql.includes("status = 'sent'")) {
      return Promise.resolve({ results: this.db.sentRows as T[] });
    }
    return Promise.resolve({ results: [] as T[] });
  }
}

class ProcessorDB {
  runs: ProcessorStatement[] = [];
  sentRows = [{ certificate_id: 'cert-ok', student_id: 'student-1', sent_at: '2026-09-14T00:00:01.000Z' }];
  prepare(sql: string) { return new ProcessorStatement(sql, this); }
  batch(statements: ProcessorStatement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

function createSqliteProcessorDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE certificate_templates (
      id TEXT PRIMARY KEY, bg_image_r2_key TEXT NOT NULL, fields_config TEXT NOT NULL,
      canvas_width INTEGER NOT NULL, canvas_height INTEGER NOT NULL, is_active INTEGER NOT NULL
    );
    CREATE TABLE certificate_batches (
      id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL, status TEXT NOT NULL,
      processing_started_at TEXT, attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT, sent_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE certificates (
      id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, student_id TEXT NOT NULL,
      student_name TEXT NOT NULL, student_score REAL, quiz_title TEXT,
      image_url TEXT, png_r2_key TEXT, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT, issued_at TEXT NOT NULL, sent_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_role TEXT NOT NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, data TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL,
      severity TEXT NOT NULL, source_type TEXT, source_id TEXT, dedupe_key TEXT,
      action_url TEXT, available_at TEXT, expires_at TEXT, read_at TEXT,
      clicked_at TEXT, sent_at TEXT, created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX notifications_dedupe ON notifications(user_id, user_role, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
    CREATE TABLE notification_preferences (
      user_id TEXT NOT NULL, user_role TEXT NOT NULL,
      action_required_enabled INTEGER NOT NULL DEFAULT 1,
      informational_enabled INTEGER NOT NULL DEFAULT 1,
      quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
      quiet_start TEXT NOT NULL DEFAULT '21:00', quiet_end TEXT NOT NULL DEFAULT '06:30',
      timezone_offset_minutes INTEGER NOT NULL DEFAULT 420,
      type_preferences_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, user_role)
    );
    CREATE TABLE parent_notifications (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, kind TEXT NOT NULL,
      source_type TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL,
      body TEXT NOT NULL, payload_json TEXT NOT NULL, is_important INTEGER NOT NULL,
      published_at TEXT NOT NULL, expires_at TEXT, read_at TEXT, revoked_at TEXT,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX parent_notifications_unique_source
      ON parent_notifications(student_id, source_type, source_id);
    INSERT INTO certificate_templates (
      id, bg_image_r2_key, fields_config, canvas_width, canvas_height, is_active
    ) VALUES ('template-1', 'templates/bg.png', '[]', 1270, 698, 1);
    INSERT INTO certificate_batches (
      id, teacher_id, status, processing_started_at, updated_at
    ) VALUES ('batch-1', 'teacher-1', 'processing', '2026-09-14T00:00:00.000Z', '2026-09-14T00:00:00.000Z');
  `);
  const insert = sqlite.prepare(`
    INSERT INTO certificates (
      id, batch_id, student_id, student_name, student_score, quiz_title,
      status, issued_at, sent_at, updated_at
    ) VALUES (?, 'batch-1', ?, ?, ?, 'Bài kiểm tra', ?, ?, ?, ?)
  `);
  for (let index = 1; index <= 21; index += 1) {
    const status = index <= 3 ? 'sent' : 'processing';
    const sentAt = index <= 3 ? `2026-09-13T22:00:0${index}.000Z` : null;
    insert.run(
      `cert-${index}`,
      `student-${index}`,
      `Học sinh ${index}`,
      10 - (index % 5),
      status,
      '2026-09-13T20:00:00.000Z',
      sentAt,
      '2026-09-14T00:00:00.000Z',
    );
  }
  return { sqlite, db: createSqliteD1(sqlite) };
}

describe('certificate batch processor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => { renderCertificateMock.mockReset(); });

  it('preserves Vietnamese and score zero, produces partial, and notifies successes only', async () => {
    const errorSpy = expectConsoleError();
    const db = new ProcessorDB();
    const renderInputs: any[] = [];
    renderCertificateMock.mockImplementation(async (params: any) => {
      if (!params) return new Uint8Array();
      renderInputs.push(params);
      const { data } = params;
      if (data.student_name === 'Học sinh lỗi') throw new Error('render rejected');
      return new Uint8Array([137, 80, 78, 71]);
    });
    const put = vi.fn(async () => undefined);
    const env = {
      DB: db,
      CERT_IMAGES: {
        get: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
        put,
      },
    } as any;

    await processBatch(env, 'batch-1', 'template-1', [
      { certificate_id: 'cert-ok', student_id: 'student-1', student_name: 'Nguyễn Việt Anh', student_score: 0, quiz_title: 'Tiếng Việt' },
      { certificate_id: 'cert-fail', student_id: 'student-2', student_name: 'Học sinh lỗi', student_score: 9, quiz_title: 'Bài rất dài '.repeat(30) },
    ], 'Cô Nguyễn', 'Hoàn thành xuất sắc', 'Tiếp tục cố gắng',
    'Đã tiến bộ vượt bậc', 'Tô Hiệu, ngày 20 tháng 7 năm 2026', 'Playwrite VN');

    expect(renderInputs[0].data).toMatchObject({
      student_name: 'Nguyễn Việt Anh', score: '0/10', teacher_name: 'Cô Nguyễn',
      date: 'Tô Hiệu, ngày 20 tháng 7 năm 2026',
    });
    expect(renderInputs[0].fieldsConfig).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'quiz_title', prefix: 'Đã tiến bộ vượt bậc ' }),
      expect.objectContaining({ key: 'date', fontSize: 33, fontStyle: 'italic', prefix: '', format: undefined }),
      expect.objectContaining({ key: 'student_name', fontFamily: 'Playwrite VN' }),
    ]));
    expect(put).toHaveBeenCalledWith('certs/cert-ok.png', expect.any(Uint8Array), expect.any(Object));
    expect(renderInputs[0].env).toBe(env);
    expect(renderInputs[0]).toMatchObject({ width: 1270, height: 698 });
    const finalBatchUpdate = db.runs.find((statement) => statement.sql.includes('SET status = ?'));
    expect(finalBatchUpdate?.bindings[0]).toBe('partial');
    const notifications = db.runs.filter((statement) => statement.sql.includes('INSERT OR IGNORE INTO notifications'));
    expect(notifications).toHaveLength(2);
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_issued')?.bindings[1])
      .toBe('student-1');
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_issued')?.bindings)
      .toContain('/student/achievements?certificate=cert-ok');
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_batch_completed')?.bindings[1])
      .toBe('teacher-1');
    expectConsoleMessage(errorSpy, 'render failed certificate=cert-fail');
  });

  it('renders certificates with at most one active render at a time', async () => {
    const db = new ProcessorDB();
    let activeRenders = 0;
    let maxActiveRenders = 0;
    renderCertificateMock.mockImplementation(async () => {
      activeRenders += 1;
      maxActiveRenders = Math.max(maxActiveRenders, activeRenders);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      activeRenders -= 1;
      return new Uint8Array([137, 80, 78, 71]);
    });
    const env = {
      DB: db,
      CERT_IMAGES: {
        get: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
        put: vi.fn(async () => undefined),
      },
    } as any;

    await processBatch(env, 'batch-1', 'template-1', [
      { certificate_id: 'cert-1', student_id: 'student-1', student_name: 'Học sinh 1', student_score: 10, quiz_title: 'Bài kiểm tra' },
      { certificate_id: 'cert-2', student_id: 'student-2', student_name: 'Học sinh 2', student_score: 9, quiz_title: 'Bài kiểm tra' },
      { certificate_id: 'cert-3', student_id: 'student-3', student_name: 'Học sinh 3', student_score: 8, quiz_title: 'Bài kiểm tra' },
    ], 'Cô Nguyễn', 'Hoàn thành xuất sắc', 'Tiếp tục cố gắng');

    expect(maxActiveRenders).toBe(1);
  });

  it('notifies the teacher when every certificate failed', async () => {
    const errors = expectConsoleError();
    const { db, sqlite } = createSqliteProcessorDb();
    sqlite.exec("UPDATE certificates SET status = 'failed'; UPDATE certificates SET status = 'processing' WHERE id = 'cert-4'");
    renderCertificateMock.mockRejectedValue(new Error('render rejected'));
    const env = { DB: db, CERT_IMAGES: {
      get: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
      put: vi.fn(),
    } } as any;
    try {
      await processBatch(env, 'batch-1', 'template-1', [{
        certificate_id: 'cert-4', student_id: 'student-4', student_name: 'Học sinh 4',
        student_score: 8, quiz_title: 'Bài kiểm tra',
      }], 'Cô Nguyễn', 'Hoàn thành xuất sắc', '', null, null, null, '2026-09-14T00:00:00.000Z');
      expect(sqlite.prepare("SELECT body FROM notifications WHERE type = 'certificate_batch_completed'").get())
        .toEqual({ body: 'Hoàn thành xuất sắc: 0/21 chứng nhận được tạo thành công.' });
      expectConsoleMessage(errors, 'render failed certificate=cert-4');
    } finally { sqlite.close(); }
  });

  it('reconciles earlier sent certificates and deduplicates the full 21-certificate fanout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T00:30:00.000Z'));
    const { db, sqlite } = createSqliteProcessorDb();
    renderCertificateMock.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
    const env = {
      DB: db,
      CERT_IMAGES: {
        get: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
        put: vi.fn(async () => undefined),
      },
    } as any;
    const students = Array.from({ length: 18 }, (_, index) => ({
      certificate_id: `cert-${index + 4}`,
      student_id: `student-${index + 4}`,
      student_name: `Học sinh ${index + 4}`,
      student_score: 10 - (index % 5),
      quiz_title: 'Bài kiểm tra',
    }));

    try {
      const lease = '2026-09-14T00:00:00.000Z';
      await processBatch(
        env,
        'batch-1',
        'template-1',
        students,
        'Cô Nguyễn',
        'Hoàn thành xuất sắc',
        'Tiếp tục cố gắng',
        null,
        'Tô Hiệu, ngày 14 tháng 9 năm 2026',
        null,
        lease,
      );

      expect(sqlite.prepare('SELECT status FROM certificate_batches WHERE id = ?').get('batch-1'))
        .toEqual({ status: 'sent' });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM certificates WHERE status = 'sent'").get())
        .toEqual({ count: 21 });
      expect(env.CERT_IMAGES.put).toHaveBeenCalledWith(
        `certs/cert-4/${encodeURIComponent(lease)}.png`, expect.any(Uint8Array), expect.any(Object),
      );
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'certificate_issued'").get())
        .toEqual({ count: 21 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM parent_notifications WHERE kind = 'certificate_issued'").get())
        .toEqual({ count: 21 });
      expect(sqlite.prepare("SELECT body FROM notifications WHERE type = 'certificate_batch_completed'").get())
        .toEqual({ body: 'Hoàn thành xuất sắc: 21/21 chứng nhận được tạo thành công.' });
      expect(sqlite.prepare("SELECT created_at FROM notifications WHERE source_id = 'cert-1'").get())
        .toEqual({ created_at: '2026-09-14T00:30:00.000Z' });

      await finalizeCertificateBatch(env, 'batch-1', 'Hoàn thành xuất sắc', 21, '2026-09-14T00:30:00.000Z');
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'certificate_issued'").get())
        .toEqual({ count: 21 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM parent_notifications WHERE kind = 'certificate_issued'").get())
        .toEqual({ count: 21 });
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('does not duplicate legacy student or parent notifications across the batch hour boundary', async () => {
    const { db, sqlite } = createSqliteProcessorDb();
    const certificateSentAt = '2026-09-14T00:59:59.000Z';
    const batchSentAt = '2026-09-14T01:00:01.000Z';
    sqlite.exec("UPDATE certificates SET status = 'failed'; UPDATE certificates SET status = 'sent' WHERE id = 'cert-1'");
    sqlite.prepare("UPDATE certificate_batches SET status = 'sent', sent_at = ? WHERE id = 'batch-1'")
      .run(batchSentAt);
    sqlite.prepare("UPDATE certificates SET sent_at = ? WHERE id = 'cert-1'")
      .run(certificateSentAt);
    const env = { DB: db } as any;

    await createNotification(db, {
      userId: 'student-1',
      userRole: 'student',
      type: 'certificate_issued',
      priority: 'IMPORTANT',
      title: 'Em có chứng nhận mới! 🎓',
      body: 'Em vừa nhận được chứng nhận: Hoàn thành xuất sắc',
      actionUrl: '/student/achievements?certificate=cert-1',
      data: { batch_id: 'batch-1', certificate_id: 'cert-1' },
      sourceType: 'certificate',
      sourceId: 'cert-1',
      createdAt: batchSentAt,
    });
    await createParentNotification(db, {
      studentId: 'student-1',
      kind: 'certificate_issued',
      sourceType: 'certificate',
      sourceId: 'cert-1',
      title: 'Con có chứng nhận mới',
      body: 'Đã nhận chứng nhận: Hoàn thành xuất sắc',
      payload: { certificateId: 'cert-1', batchId: 'batch-1' },
      publishedAt: batchSentAt,
    });

    await finalizeCertificateBatch(env, 'batch-1', 'Hoàn thành xuất sắc', 21, '2026-09-14T01:00:02.000Z', 'sent');

    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'certificate_issued'").get())
      .toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM parent_notifications WHERE kind = 'certificate_issued'").get())
      .toEqual({ count: 1 });
    sqlite.close();
  });
});
