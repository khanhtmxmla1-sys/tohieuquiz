// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';
import { createSqliteD1 } from './helpers/sqliteD1';

const processBatchMock = vi.hoisted(() => vi.fn());
const finalizeBatchMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/services/certificateBatchProcessor', () => ({
  processBatch: processBatchMock,
  finalizeCertificateBatch: finalizeBatchMock,
}));

import certificateQueue from '../workers/src/queues/certificateQueue';

class QueueStatement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: QueueDB) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  first<T>() {
    if (this.sql.includes('total_count')) {
      return Promise.resolve({
        total_count: this.db.certificateRows.length,
        pending_count: this.db.certificateRows.length,
        processing_count: 0,
        sent_count: 0,
        failed_count: 0,
      } as T);
    }
    if (this.sql.includes('SELECT status, processing_started_at')) {
      return Promise.resolve({
        status: this.db.batchRow.status,
        processing_started_at: this.db.batchRow.processing_started_at,
      } as T);
    }
    if (this.sql.includes('FROM certificate_batches')) {
      return Promise.resolve(this.db.batchRow as T);
    }
    if (this.sql.includes('FROM teachers')) {
      return Promise.resolve({ full_name: 'Cô giáo' } as T);
    }
    return Promise.resolve(null);
  }

  all<T>() {
    const results = this.sql.includes("c.status = 'pending'")
      ? this.db.certificateRows.filter((row) => this.db.certificateStatuses.get(row.certificate_id) !== 'sent')
      : this.db.certificateRows;
    return Promise.resolve({ results: results as T[] });
  }

  run() {
    this.db.runs.push(this);
    if (this.sql.includes("SET status = 'pending'") && this.sql.includes("status = 'processing'")) {
      for (const [certificateId, status] of this.db.certificateStatuses) {
        if (status === 'processing') this.db.certificateStatuses.set(certificateId, 'pending');
      }
    }
    return Promise.resolve({ success: true, meta: { changes: 1 } });
  }
}

class QueueDB {
  batchRow = {
    id: 'batch-1',
    teacher_id: 'teacher-1',
    template_id: 'template-1',
    title: 'Hoàn thành tốt',
    message: null,
    achievement_prefix: 'Đã tiến bộ vượt bậc',
    date_line: 'TôHiệuQuiz, ngày 20 tháng 7 năm 2026',
    student_name_font: 'Allura',
    status: 'pending',
    processing_started_at: null,
  };
  certificateRows = [{
    certificate_id: 'cert-1',
    student_id: 'student-1',
    student_name: 'Học sinh 1',
    student_score: 10,
    quiz_title: 'Bài kiểm tra',
  }];
  certificateStatuses = new Map<string, 'pending' | 'processing' | 'sent'>();
  runs: QueueStatement[] = [];
  batches: QueueStatement[][] = [];

  prepare(sql: string) {
    return new QueueStatement(sql, this);
  }

  batch(statements: QueueStatement[]) {
    this.batches.push(statements);
    return Promise.resolve(statements.map(() => ({ success: true, meta: { changes: 1 } })));
  }
}

function queueMessage(attempts = 1) {
  return {
    body: { batchId: 'batch-1' },
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

async function dispatch(db: QueueDB, message: ReturnType<typeof queueMessage>) {
  await certificateQueue.queue(
    { messages: [message] } as any,
    { DB: db } as any,
    {} as ExecutionContext,
  );
}

function createSqliteQueueDb({
  batchStatus = 'processing',
  processingStartedAt = '2026-09-13T20:00:00.000Z',
  sentCount = 3,
  processingCount = 18,
}: {
  batchStatus?: string;
  processingStartedAt?: string | null;
  sentCount?: number;
  processingCount?: number;
} = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE certificate_batches (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      achievement_prefix TEXT,
      date_line TEXT,
      student_name_font TEXT,
      status TEXT NOT NULL,
      processing_started_at TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      sent_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE certificates (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      student_score REAL,
      quiz_title TEXT,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      issued_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL);
    CREATE TABLE teachers (username TEXT PRIMARY KEY, full_name TEXT NOT NULL);
    INSERT INTO certificate_batches (
      id, teacher_id, template_id, title, message, achievement_prefix, date_line,
      student_name_font, status, processing_started_at, updated_at
    ) VALUES (
      'batch-1', 'teacher-1', 'template-1', 'Hoàn thành tốt', NULL,
      'Đã tiến bộ vượt bậc', 'Tô Hiệu, ngày 20 tháng 7 năm 2026', 'Allura',
      '${batchStatus}', ${processingStartedAt === null ? 'NULL' : `'${processingStartedAt}'`},
      '2026-09-13T20:00:00.000Z'
    );
    INSERT INTO teachers (username, full_name) VALUES ('teacher-1', 'Cô giáo');
  `);

  const insertStudent = sqlite.prepare('INSERT INTO students (id, full_name) VALUES (?, ?)');
  const insertCertificate = sqlite.prepare(`
    INSERT INTO certificates (
      id, batch_id, student_id, student_name, student_score, quiz_title,
      status, issued_at, sent_at, updated_at
    ) VALUES (?, 'batch-1', ?, ?, ?, 'Bài kiểm tra', ?, ?, ?, ?)
  `);
  const issuedAt = '2026-09-13T20:00:00.000Z';
  for (let index = 1; index <= sentCount + processingCount; index += 1) {
    const certificateId = `cert-${index}`;
    const studentId = `student-${index}`;
    const status = index <= sentCount ? 'sent' : 'processing';
    const sentAt = status === 'sent' ? `2026-09-13T20:01:${String(index).padStart(2, '0')}.000Z` : null;
    insertStudent.run(studentId, `Học sinh ${index}`);
    insertCertificate.run(
      certificateId,
      studentId,
      `Học sinh ${index}`,
      10 - (index % 5),
      status,
      issuedAt,
      sentAt,
      issuedAt,
    );
  }

  return { sqlite, db: createSqliteD1(sqlite) };
}

describe('certificate queue delivery semantics', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T00:00:00.000Z'));
    finalizeBatchMock.mockReset().mockResolvedValue(undefined);
    processBatchMock.mockReset();
    processBatchMock.mockResolvedValue(undefined);
  });

  it('acknowledges an already completed duplicate message', async () => {
    const db = new QueueDB();
    db.batchRow.status = 'sent';
    const message = queueMessage();

    await dispatch(db, message);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(processBatchMock).not.toHaveBeenCalled();
    expect(finalizeBatchMock).toHaveBeenCalledOnce();
  });

  it('processes a pending batch successfully and acknowledges it', async () => {
    const db = new QueueDB();
    const message = queueMessage();

    await dispatch(db, message);

    expect(processBatchMock).toHaveBeenCalledOnce();
    expect(processBatchMock.mock.calls[0][7]).toBe('Đã tiến bộ vượt bậc');
    expect(processBatchMock.mock.calls[0][8]).toBe('TôHiệuQuiz, ngày 20 tháng 7 năm 2026');
    expect(processBatchMock.mock.calls[0][9]).toBe('Allura');
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('reclaims unfinished certificates on redelivery and resumes without touching sent rows', async () => {
    const db = new QueueDB();
    db.batchRow.status = 'processing';
    db.batchRow.processing_started_at = '2026-09-13T00:00:00.000Z';
    db.certificateRows = [
      ...db.certificateRows,
      { ...db.certificateRows[0], certificate_id: 'cert-sent', student_id: 'student-sent' },
    ];
    db.certificateStatuses.set('cert-1', 'processing');
    db.certificateStatuses.set('cert-sent', 'sent');
    const message = queueMessage(2);

    await dispatch(db, message);

    expect(processBatchMock).toHaveBeenCalledOnce();
    expect(processBatchMock.mock.calls[0][3]).toEqual([
      expect.objectContaining({ certificate_id: 'cert-1' }),
    ]);
    expect(db.certificateStatuses.get('cert-1')).toBe('pending');
    expect(db.certificateStatuses.get('cert-sent')).toBe('sent');
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    const reclaim = db.runs.find((statement) => statement.sql.includes("SET status = 'pending'"));
    expect(reclaim?.sql).toContain("WHERE batch_id = ? AND status = 'processing'");
    expect(reclaim?.sql).not.toContain("status = 'sent'");
  });

  it('waits for the active lease on a duplicate delivery instead of reclaiming it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T20:00:30.000Z'));
    const { db, sqlite } = createSqliteQueueDb();
    const message = queueMessage(2);

    try {
      await dispatch(db, message);

      expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 571 });
      expect(message.ack).not.toHaveBeenCalled();
      expect(processBatchMock).not.toHaveBeenCalled();
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM certificates WHERE status = 'processing'").get())
        .toEqual({ count: 18 });
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('allows only one stale claimant to reclaim and process a batch', async () => {
    const { db, sqlite } = createSqliteQueueDb();
    const first = queueMessage(2);
    const second = queueMessage(2);

    try {
      await Promise.all([dispatch(db, first), dispatch(db, second)]);

      expect(processBatchMock).toHaveBeenCalledOnce();
      expect([first, second].filter((message) => message.retry.mock.calls.length === 1)).toHaveLength(1);
      expect(sqlite.prepare('SELECT attempt_count FROM certificate_batches WHERE id = ?').get('batch-1'))
        .toEqual({ attempt_count: 1 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM certificates WHERE status = 'sent'").get())
        .toEqual({ count: 3 });
      expect(sqlite.prepare('SELECT SUM(attempt_count) AS attempts FROM certificates').get())
        .toEqual({ attempts: 18 });
    } finally {
      sqlite.close();
    }
  });

  it('finalizes an all-sent batch when recovery finds no pending certificates', async () => {
    const { db, sqlite } = createSqliteQueueDb({ sentCount: 21, processingCount: 0 });
    const message = queueMessage(2);

    try {
      await dispatch(db, message);

      expect(processBatchMock).not.toHaveBeenCalled();
      expect(message.ack).toHaveBeenCalledOnce();
      expect(sqlite.prepare('SELECT status FROM certificate_batches WHERE id = ?').get('batch-1'))
        .toEqual({ status: 'sent' });
      expect(finalizeBatchMock).toHaveBeenCalledWith(
        expect.anything(), 'batch-1', 'Hoàn thành tốt', 21, expect.any(String), 'sent',
      );
    } finally {
      sqlite.close();
    }
  });

  it('retries a transient processor failure without acknowledging it', async () => {
    const errorSpy = expectConsoleError();
    const db = new QueueDB();
    const message = queueMessage(1);
    processBatchMock.mockRejectedValueOnce(new Error('R2 temporarily unavailable'));

    await dispatch(db, message);

    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(db.batches).toHaveLength(1);
    expectConsoleMessage(errorSpy, 'failed batch=batch-1 attempt=1');
  });

  it('marks the final attempt failed without acknowledging it so Cloudflare can route it to the DLQ', async () => {
    const errorSpy = expectConsoleError();
    const db = new QueueDB();
    const message = queueMessage(3);
    processBatchMock.mockRejectedValueOnce(new Error('render failed'));

    await dispatch(db, message);

    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][1].sql).toContain("status = 'failed'");
    expectConsoleMessage(errorSpy, 'failed batch=batch-1 attempt=3');
  });
});
