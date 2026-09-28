// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from './helpers/sqliteD1';

const reconcileBatchMock = vi.hoisted(() => vi.fn());
vi.mock('../workers/src/services/certificateBatchState', () => ({
  reconcileCertificateBatch: reconcileBatchMock,
}));

import { recoverStaleCertificateWork } from '../workers/src/services/certificateRecoveryService';

function createRecoveryDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE certificate_batches (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO certificate_batches (id, status, updated_at)
      VALUES ('batch-1', 'processing', '2026-09-28T00:00:00.000Z');
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
  `);
  return { sqlite, db: createSqliteD1(sqlite) };
}

function insertCertificate(
  sqlite: DatabaseSync,
  row: {
    id: string;
    status: string;
    attempt?: number;
    processingStartedAt?: string | null;
    processingToken?: string | null;
    enqueuedAt?: string | null;
    issuedAt?: string;
  },
) {
  sqlite.prepare(`
    INSERT INTO certificates (
      id, batch_id, status, attempt_count, processing_started_at,
      processing_token, enqueued_at, error_message, issued_at, updated_at
    ) VALUES (?, 'batch-1', ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    row.id,
    row.status,
    row.attempt ?? 0,
    row.processingStartedAt ?? null,
    row.processingToken ?? null,
    row.enqueuedAt ?? null,
    row.issuedAt ?? '2026-09-28T00:00:00.000Z',
    row.issuedAt ?? '2026-09-28T00:00:00.000Z',
  );
}

describe('certificate recovery service', () => {
  beforeEach(() => {
    reconcileBatchMock.mockReset().mockResolvedValue('processing');
  });

  it('requeues pending work whose queue message was never claimed', async () => {
    const { sqlite, db } = createRecoveryDb();
    insertCertificate(sqlite, { id: 'cert-pending', status: 'pending' });
    const send = vi.fn(async () => undefined);
    try {
      const result = await recoverStaleCertificateWork(
        { DB: db, CERTIFICATE_QUEUE: { send } } as any,
        new Date('2026-09-28T01:00:00.000Z'),
      );

      expect(result).toEqual({ requeued: 1, failed: 0, reconciledBatches: 0 });
      expect(send).toHaveBeenCalledWith({
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-pending',
      });
      expect(sqlite.prepare(
        "SELECT enqueued_at FROM certificates WHERE id = 'cert-pending'",
      ).get()).toEqual({ enqueued_at: '2026-09-28T01:00:00.000Z' });
    } finally {
      sqlite.close();
    }
  });

  it('requeues stale processing work and legacy processing rows with no item lease', async () => {
    const { sqlite, db } = createRecoveryDb();
    insertCertificate(sqlite, {
      id: 'cert-stale',
      status: 'processing',
      attempt: 2,
      processingStartedAt: '2026-09-28T00:55:00.000Z',
      processingToken: 'old',
    });
    insertCertificate(sqlite, {
      id: 'cert-legacy',
      status: 'processing',
      attempt: 2,
      processingStartedAt: null,
      processingToken: null,
    });
    const send = vi.fn(async () => undefined);
    try {
      const result = await recoverStaleCertificateWork(
        { DB: db, CERTIFICATE_QUEUE: { send } } as any,
        new Date('2026-09-28T01:00:00.000Z'),
      );

      expect(result.requeued).toBe(2);
      expect(send).toHaveBeenCalledWith({
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-stale',
      });
      expect(send).toHaveBeenCalledWith({
        kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-legacy',
      });
    } finally {
      sqlite.close();
    }
  });

  it('never requeues sent certificates or a fresh processing lease', async () => {
    const { sqlite, db } = createRecoveryDb();
    insertCertificate(sqlite, { id: 'cert-sent', status: 'sent' });
    insertCertificate(sqlite, {
      id: 'cert-active',
      status: 'processing',
      attempt: 1,
      processingStartedAt: '2026-09-28T00:59:30.000Z',
      processingToken: 'active',
    });
    const send = vi.fn(async () => undefined);
    try {
      const result = await recoverStaleCertificateWork(
        { DB: db, CERTIFICATE_QUEUE: { send } } as any,
        new Date('2026-09-28T01:00:00.000Z'),
      );

      expect(result).toEqual({ requeued: 0, failed: 0, reconciledBatches: 0 });
      expect(send).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
    }
  });

  it('reconciles a stale batch after the last certificate was sent before batch finalization', async () => {
    const { sqlite, db } = createRecoveryDb();
    insertCertificate(sqlite, { id: 'cert-sent', status: 'sent' });
    const send = vi.fn(async () => undefined);
    try {
      const result = await recoverStaleCertificateWork(
        { DB: db, CERTIFICATE_QUEUE: { send } } as any,
        new Date('2026-09-28T01:00:00.000Z'),
      );

      expect(result).toEqual({ requeued: 0, failed: 0, reconciledBatches: 1 });
      expect(send).not.toHaveBeenCalled();
      expect(reconcileBatchMock).toHaveBeenCalledWith(expect.anything(), 'batch-1');
    } finally {
      sqlite.close();
    }
  });

  it('fails exhausted stale work and reconciles the batch instead of requeueing forever', async () => {
    const { sqlite, db } = createRecoveryDb();
    insertCertificate(sqlite, {
      id: 'cert-exhausted',
      status: 'processing',
      attempt: 5,
      processingStartedAt: '2026-09-28T00:55:00.000Z',
      processingToken: 'old',
    });
    const send = vi.fn(async () => undefined);
    try {
      const result = await recoverStaleCertificateWork(
        { DB: db, CERTIFICATE_QUEUE: { send } } as any,
        new Date('2026-09-28T01:00:00.000Z'),
      );

      expect(result).toEqual({ requeued: 0, failed: 1, reconciledBatches: 1 });
      expect(send).not.toHaveBeenCalled();
      expect(sqlite.prepare(`
        SELECT status, processing_started_at, processing_token, enqueued_at, error_message
        FROM certificates WHERE id = 'cert-exhausted'
      `).get()).toEqual({
        status: 'failed',
        processing_started_at: null,
        processing_token: null,
        enqueued_at: null,
        error_message: 'CERTIFICATE_RENDER_ATTEMPTS_EXHAUSTED',
      });
      expect(reconcileBatchMock).toHaveBeenCalledWith(expect.anything(), 'batch-1');
    } finally {
      sqlite.close();
    }
  });
});
