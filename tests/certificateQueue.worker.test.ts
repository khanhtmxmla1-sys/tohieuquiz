// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from './helpers/sqliteD1';

const processCertificateMock = vi.hoisted(() => vi.fn());
const processBatchMock = vi.hoisted(() => vi.fn());
const reconcileBatchMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/services/certificateBatchProcessor', () => ({
  processCertificate: processCertificateMock,
  processBatch: processBatchMock,
}));

vi.mock('../workers/src/services/certificateBatchState', () => ({
  reconcileCertificateBatch: reconcileBatchMock,
}));

import certificateQueue from '../workers/src/queues/certificateQueue';

function createQueueDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE certificate_batches (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE certificates (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      processing_started_at TEXT,
      processing_token TEXT,
      enqueued_at TEXT,
      error_message TEXT,
      issued_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO certificate_batches (id, status, updated_at)
      VALUES ('batch-1', 'pending', '2026-09-28T00:00:00.000Z');
    INSERT INTO certificates (
      id, batch_id, status, attempt_count, processing_started_at,
      processing_token, enqueued_at, error_message, issued_at, updated_at
    ) VALUES
      ('cert-1', 'batch-1', 'pending', 0, NULL, NULL, NULL, NULL,
       '2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.000Z'),
      ('cert-2', 'batch-1', 'pending', 0, NULL, NULL, NULL, NULL,
       '2026-09-28T00:00:01.000Z', '2026-09-28T00:00:01.000Z'),
      ('cert-3', 'batch-1', 'pending', 0, NULL, NULL, NULL, NULL,
       '2026-09-28T00:00:02.000Z', '2026-09-28T00:00:02.000Z');
  `);
  return { sqlite, db: createSqliteD1(sqlite) };
}

function queueMessage(body: unknown, attempts = 1) {
  return {
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

async function dispatch(
  db: D1Database,
  message: ReturnType<typeof queueMessage>,
  send = vi.fn(async () => undefined),
) {
  await certificateQueue.queue(
    { messages: [message] } as any,
    { DB: db, CERTIFICATE_QUEUE: { send } } as any,
    {} as ExecutionContext,
  );
  return send;
}

describe('certificate queue per-item delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T01:00:00.000Z'));
    processBatchMock.mockReset();
    reconcileBatchMock.mockReset().mockResolvedValue('processing');
    processCertificateMock.mockReset().mockImplementation(async (env: any, input: any) => {
      await env.DB.prepare(`
        UPDATE certificates
        SET status = 'sent', processing_started_at = NULL,
            processing_token = NULL, enqueued_at = NULL, updated_at = ?
        WHERE id = ? AND batch_id = ? AND processing_token = ?
      `).bind(
        new Date().toISOString(),
        input.certificateId,
        input.batchId,
        input.processingToken,
      ).run();
      return 'sent';
    });
  });

  it('dispatches one render message per eligible certificate and never renders the batch', async () => {
    const { sqlite, db } = createQueueDb();
    const message = queueMessage({ kind: 'dispatch_batch', batchId: 'batch-1' });
    try {
      const send = await dispatch(db, message);

      expect(processBatchMock).not.toHaveBeenCalled();
      expect(processCertificateMock).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(3);
      expect(send).toHaveBeenNthCalledWith(1, {
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-1',
      });
      expect(send).toHaveBeenNthCalledWith(2, {
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
      });
      expect(send).toHaveBeenNthCalledWith(3, {
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-3',
      });
      expect(sqlite.prepare(
        'SELECT COUNT(*) AS count FROM certificates WHERE enqueued_at IS NOT NULL',
      ).get()).toEqual({ count: 3 });
      expect(message.ack).toHaveBeenCalledOnce();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('renders exactly the addressed certificate', async () => {
    const { sqlite, db } = createQueueDb();
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    });
    try {
      await dispatch(db, message);

      expect(processCertificateMock).toHaveBeenCalledTimes(1);
      expect(processCertificateMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ batchId: 'batch-1', certificateId: 'cert-2' }),
      );
      expect(sqlite.prepare(
        "SELECT id, status, attempt_count FROM certificates ORDER BY id",
      ).all()).toEqual([
        { id: 'cert-1', status: 'pending', attempt_count: 0 },
        { id: 'cert-2', status: 'sent', attempt_count: 1 },
        { id: 'cert-3', status: 'pending', attempt_count: 0 },
      ]);
      expect(reconcileBatchMock).toHaveBeenCalledWith(expect.anything(), 'batch-1');
      expect(message.ack).toHaveBeenCalledOnce();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('keeps legacy batch messages compatible as dispatch requests', async () => {
    const { sqlite, db } = createQueueDb();
    const message = queueMessage({ batchId: 'batch-1' });
    try {
      const send = await dispatch(db, message);
      expect(send).toHaveBeenCalledTimes(3);
      expect(processBatchMock).not.toHaveBeenCalled();
      expect(message.ack).toHaveBeenCalledOnce();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('makes duplicate render delivery idempotent after the first delivery is sent', async () => {
    const { sqlite, db } = createQueueDb();
    const first = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-1',
    });
    const duplicate = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-1',
    });
    try {
      await dispatch(db, first);
      await dispatch(db, duplicate);

      expect(processCertificateMock).toHaveBeenCalledTimes(1);
      expect(first.ack).toHaveBeenCalledOnce();
      expect(duplicate.ack).toHaveBeenCalledOnce();
      expect(duplicate.retry).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('reclaims one stale processing certificate without touching sent rows', async () => {
    const { sqlite, db } = createQueueDb();
    sqlite.exec(`
      UPDATE certificates SET status = 'sent' WHERE id = 'cert-1';
      UPDATE certificates
      SET status = 'processing', attempt_count = 1,
          processing_started_at = '2026-09-28T00:55:00.000Z',
          processing_token = 'old-token'
      WHERE id = 'cert-2';
    `);
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    }, 2);
    try {
      await dispatch(db, message);

      expect(processCertificateMock).toHaveBeenCalledTimes(1);
      expect(sqlite.prepare(
        "SELECT status, attempt_count FROM certificates WHERE id = 'cert-2'",
      ).get()).toEqual({ status: 'sent', attempt_count: 2 });
      expect(sqlite.prepare(
        "SELECT status FROM certificates WHERE id = 'cert-1'",
      ).get()).toEqual({ status: 'sent' });
      expect(message.ack).toHaveBeenCalledOnce();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('treats a processing row with no item lease as stale legacy work', async () => {
    const { sqlite, db } = createQueueDb();
    sqlite.exec(`
      UPDATE certificates
      SET status = 'processing', attempt_count = 2,
          processing_started_at = NULL, processing_token = NULL
      WHERE id = 'cert-2';
    `);
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    }, 3);
    try {
      await dispatch(db, message);
      expect(processCertificateMock).toHaveBeenCalledTimes(1);
      expect(sqlite.prepare(
        "SELECT status, attempt_count FROM certificates WHERE id = 'cert-2'",
      ).get()).toEqual({ status: 'sent', attempt_count: 3 });
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('acknowledges a duplicate while a fresh item lease is still active', async () => {
    const { sqlite, db } = createQueueDb();
    sqlite.exec(`
      UPDATE certificates
      SET status = 'processing', attempt_count = 1,
          processing_started_at = '2026-09-28T00:59:30.000Z',
          processing_token = 'active-token'
      WHERE id = 'cert-2';
    `);
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    }, 2);
    try {
      await dispatch(db, message);
      expect(processCertificateMock).not.toHaveBeenCalled();
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
      expect(sqlite.prepare(
        "SELECT status, processing_token FROM certificates WHERE id = 'cert-2'",
      ).get()).toEqual({ status: 'processing', processing_token: 'active-token' });
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('marks exhausted stale work failed instead of leaving it processing', async () => {
    const { sqlite, db } = createQueueDb();
    sqlite.exec(`
      UPDATE certificates
      SET status = 'processing', attempt_count = 5,
          processing_started_at = '2026-09-28T00:55:00.000Z',
          processing_token = 'old-token'
      WHERE id = 'cert-2';
    `);
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    }, 5);
    try {
      await dispatch(db, message);
      expect(processCertificateMock).not.toHaveBeenCalled();
      expect(sqlite.prepare(`
        SELECT status, processing_started_at, processing_token, error_message
        FROM certificates WHERE id = 'cert-2'
      `).get()).toEqual({
        status: 'failed',
        processing_started_at: null,
        processing_token: null,
        error_message: 'CERTIFICATE_RENDER_ATTEMPTS_EXHAUSTED',
      });
      expect(reconcileBatchMock).toHaveBeenCalledWith(expect.anything(), 'batch-1');
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('returns a caught transient render failure to pending and retries the item', async () => {
    const { sqlite, db } = createQueueDb();
    processCertificateMock.mockRejectedValueOnce(new Error('R2 temporarily unavailable'));
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    });
    try {
      await dispatch(db, message);
      expect(sqlite.prepare(`
        SELECT status, attempt_count, processing_started_at, processing_token,
               enqueued_at, error_message
        FROM certificates WHERE id = 'cert-2'
      `).get()).toEqual({
        status: 'pending',
        attempt_count: 1,
        processing_started_at: null,
        processing_token: null,
        enqueued_at: null,
        error_message: 'R2 temporarily unavailable',
      });
      expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
      expect(message.ack).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('acks a lease-lost renderer without resetting the newer owner', async () => {
    const { sqlite, db } = createQueueDb();
    processCertificateMock.mockRejectedValueOnce(new Error('CERTIFICATE_LEASE_LOST'));
    const message = queueMessage({
      kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-2',
    });
    try {
      await dispatch(db, message);
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });

  it('acks malformed messages without rendering', async () => {
    const { sqlite, db } = createQueueDb();
    const message = queueMessage({ kind: 'render_certificate', batchId: '' });
    try {
      await dispatch(db, message);
      expect(processCertificateMock).not.toHaveBeenCalled();
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
      vi.useRealTimers();
    }
  });
});
