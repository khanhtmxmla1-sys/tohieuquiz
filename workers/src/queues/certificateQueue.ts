import type { Env } from '../types';
import { processCertificate } from '../services/certificateBatchProcessor';
import { reconcileCertificateBatch } from '../services/certificateBatchState';
import {
  normalizeCertificateQueueMessage,
  type CertificateQueueMessage,
} from '../services/certificateQueueMessages';

const CERTIFICATE_LEASE_MS = 2 * 60 * 1000;
const CERTIFICATE_ENQUEUE_STALE_MS = 2 * 60 * 1000;
const MAX_CERTIFICATE_RENDER_ATTEMPTS = 5;
const DISPATCH_PAGE_SIZE = 25;

interface CertificateQueueRow {
  id: string;
  batch_id: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'revoked';
  attempt_count: number;
  processing_started_at: string | null;
  processing_token: string | null;
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 30 * (2 ** Math.max(0, attempt - 1)));
}

function changed(result: D1Result<unknown> | null | undefined): boolean {
  return Number(result?.meta?.changes ?? 0) > 0;
}

function before(now: Date, milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString();
}

function processingIsStale(row: CertificateQueueRow, staleBefore: string): boolean {
  if (row.status !== 'processing') return false;
  if (!row.processing_started_at) return true;
  const startedAt = Date.parse(row.processing_started_at);
  return !Number.isFinite(startedAt) || startedAt < Date.parse(staleBefore);
}

async function dispatchBatch(
  env: Env,
  queueMessage: Message<CertificateQueueMessage>,
  batchId: string,
): Promise<void> {
  const batch = await env.DB.prepare(`
    SELECT status
    FROM certificate_batches
    WHERE id = ?
  `).bind(batchId).first<{ status: string }>();

  if (!batch || ['sent', 'partial', 'failed'].includes(batch.status)) {
    queueMessage.ack();
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleEnqueuedBefore = before(now, CERTIFICATE_ENQUEUE_STALE_MS);
  const page = await env.DB.prepare(`
    SELECT id
    FROM certificates
    WHERE batch_id = ?
      AND status = 'pending'
      AND (enqueued_at IS NULL OR enqueued_at < ?)
    ORDER BY issued_at, id
    LIMIT ?
  `).bind(batchId, staleEnqueuedBefore, DISPATCH_PAGE_SIZE).all<{ id: string }>();

  for (const certificate of page.results) {
    const reservation = await env.DB.prepare(`
      UPDATE certificates
      SET enqueued_at = ?, updated_at = ?
      WHERE id = ? AND batch_id = ?
        AND status = 'pending'
        AND (enqueued_at IS NULL OR enqueued_at < ?)
    `).bind(
      nowIso,
      nowIso,
      certificate.id,
      batchId,
      staleEnqueuedBefore,
    ).run();

    if (!changed(reservation)) continue;

    try {
      await env.CERTIFICATE_QUEUE.send({
        kind: 'render_certificate',
        batchId,
        certificateId: certificate.id,
      });
    } catch (error) {
      await env.DB.prepare(`
        UPDATE certificates
        SET enqueued_at = NULL, updated_at = ?
        WHERE id = ? AND batch_id = ?
          AND status = 'pending'
          AND enqueued_at = ?
      `).bind(new Date().toISOString(), certificate.id, batchId, nowIso).run();
      throw error;
    }
  }

  if (page.results.length === DISPATCH_PAGE_SIZE) {
    await env.CERTIFICATE_QUEUE.send({ kind: 'dispatch_batch', batchId });
  }

  await reconcileCertificateBatch(env, batchId);
  queueMessage.ack();
}

async function markExhausted(
  env: Env,
  batchId: string,
  certificateId: string,
  staleBefore: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`
    UPDATE certificates
    SET status = 'failed',
        processing_started_at = NULL,
        processing_token = NULL,
        enqueued_at = NULL,
        error_message = 'CERTIFICATE_RENDER_ATTEMPTS_EXHAUSTED',
        updated_at = ?
    WHERE id = ? AND batch_id = ?
      AND attempt_count >= ?
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND (processing_started_at IS NULL OR processing_started_at < ?)
        )
      )
  `).bind(
    now,
    certificateId,
    batchId,
    MAX_CERTIFICATE_RENDER_ATTEMPTS,
    staleBefore,
  ).run();
  return changed(result);
}

async function renderOneCertificate(
  env: Env,
  queueMessage: Message<CertificateQueueMessage>,
  batchId: string,
  certificateId: string,
): Promise<void> {
  const current = await env.DB.prepare(`
    SELECT id, batch_id, status, attempt_count, processing_started_at, processing_token
    FROM certificates
    WHERE id = ? AND batch_id = ?
  `).bind(certificateId, batchId).first<CertificateQueueRow>();

  if (!current || ['sent', 'failed', 'revoked'].includes(current.status)) {
    queueMessage.ack();
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = before(now, CERTIFICATE_LEASE_MS);

  if (current.status === 'processing' && !processingIsStale(current, staleBefore)) {
    queueMessage.ack();
    return;
  }

  if (Number(current.attempt_count || 0) >= MAX_CERTIFICATE_RENDER_ATTEMPTS) {
    if (await markExhausted(env, batchId, certificateId, staleBefore)) {
      await reconcileCertificateBatch(env, batchId);
    }
    queueMessage.ack();
    return;
  }

  const processingToken = crypto.randomUUID();
  const claim = await env.DB.prepare(`
    UPDATE certificates
    SET status = 'processing',
        attempt_count = attempt_count + 1,
        processing_started_at = ?,
        processing_token = ?,
        error_message = NULL,
        updated_at = ?
    WHERE id = ? AND batch_id = ?
      AND attempt_count < ?
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND (processing_started_at IS NULL OR processing_started_at < ?)
        )
      )
  `).bind(
    nowIso,
    processingToken,
    nowIso,
    certificateId,
    batchId,
    MAX_CERTIFICATE_RENDER_ATTEMPTS,
    staleBefore,
  ).run();

  if (!changed(claim)) {
    queueMessage.ack();
    return;
  }

  const claimedAttempt = Number(current.attempt_count || 0) + 1;

  try {
    await processCertificate(env, { batchId, certificateId, processingToken });
    await reconcileCertificateBatch(env, batchId);
    queueMessage.ack();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'CERTIFICATE_LEASE_LOST') {
      await reconcileCertificateBatch(env, batchId);
      queueMessage.ack();
      return;
    }

    const failureText = errorMessage.slice(0, 1000);
    if (claimedAttempt >= MAX_CERTIFICATE_RENDER_ATTEMPTS) {
      const failed = await env.DB.prepare(`
        UPDATE certificates
        SET status = 'failed',
            processing_started_at = NULL,
            processing_token = NULL,
            enqueued_at = NULL,
            error_message = ?,
            updated_at = ?
        WHERE id = ? AND batch_id = ?
          AND status = 'processing'
          AND processing_token = ?
      `).bind(
        failureText,
        new Date().toISOString(),
        certificateId,
        batchId,
        processingToken,
      ).run();
      if (changed(failed)) await reconcileCertificateBatch(env, batchId);
      queueMessage.ack();
      return;
    }

    const reset = await env.DB.prepare(`
      UPDATE certificates
      SET status = 'pending',
          processing_started_at = NULL,
          processing_token = NULL,
          enqueued_at = NULL,
          error_message = ?,
          updated_at = ?
      WHERE id = ? AND batch_id = ?
        AND status = 'processing'
        AND processing_token = ?
    `).bind(
      failureText,
      new Date().toISOString(),
      certificateId,
      batchId,
      processingToken,
    ).run();

    if (!changed(reset)) {
      queueMessage.ack();
      return;
    }

    queueMessage.retry({ delaySeconds: retryDelaySeconds(claimedAttempt) });
  }
}

export default {
  async queue(
    batch: MessageBatch<CertificateQueueMessage>,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`[CertQueue] messages=${batch.messages.length}`);

    for (const queueMessage of batch.messages) {
      const message = normalizeCertificateQueueMessage(queueMessage.body);
      if (!message) {
        console.error('[CertQueue] ignored malformed certificate queue message');
        queueMessage.ack();
        continue;
      }

      try {
        if (message.kind === 'dispatch_batch') {
          await dispatchBatch(env, queueMessage, message.batchId);
        } else {
          await renderOneCertificate(
            env,
            queueMessage,
            message.batchId,
            message.certificateId,
          );
        }
      } catch (error) {
        console.error('[CertQueue] queue handler failed', {
          kind: message.kind,
          batchId: message.batchId,
          certificateId: message.kind === 'render_certificate' ? message.certificateId : undefined,
          error: error instanceof Error ? error.message : String(error),
        });
        queueMessage.retry({ delaySeconds: retryDelaySeconds(queueMessage.attempts) });
      }
    }
  },
};
