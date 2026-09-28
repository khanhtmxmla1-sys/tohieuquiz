import type { Env } from '../types';
import { reconcileCertificateBatch } from './certificateBatchState';

const CERTIFICATE_RECOVERY_STALE_MS = 2 * 60 * 1000;
const MAX_CERTIFICATE_RENDER_ATTEMPTS = 5;
const RECOVERY_LIMIT = 50;
const RECOVERY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface RecoveryRow {
  id: string;
  batch_id: string;
  status: 'pending' | 'processing';
  attempt_count: number;
  processing_started_at: string | null;
  enqueued_at: string | null;
}

function changed(result: D1Result<unknown> | null | undefined): boolean {
  return Number(result?.meta?.changes ?? 0) > 0;
}

export async function recoverStaleCertificateWork(
  env: Env,
  now: Date = new Date(),
): Promise<{ requeued: number; failed: number; reconciledBatches: number }> {
  if (!env.CERTIFICATE_QUEUE) {
    return { requeued: 0, failed: 0, reconciledBatches: 0 };
  }

  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - CERTIFICATE_RECOVERY_STALE_MS).toISOString();
  const issuedAfter = new Date(now.getTime() - RECOVERY_LOOKBACK_MS).toISOString();

  const stale = await env.DB.prepare(`
    SELECT id, batch_id, status, attempt_count, processing_started_at, enqueued_at
    FROM certificates
    WHERE issued_at >= ?
      AND (
        (
          status = 'pending'
          AND (enqueued_at IS NULL OR enqueued_at < ?)
        )
        OR (
          status = 'processing'
          AND (processing_started_at IS NULL OR processing_started_at < ?)
        )
      )
    ORDER BY updated_at, id
    LIMIT ?
  `).bind(
    issuedAfter,
    staleBefore,
    staleBefore,
    RECOVERY_LIMIT,
  ).all<RecoveryRow>();

  let requeued = 0;
  let failed = 0;
  const reconciledBatchIds = new Set<string>();

  for (const row of stale.results) {
    if (Number(row.attempt_count || 0) >= MAX_CERTIFICATE_RENDER_ATTEMPTS) {
      const failure = await env.DB.prepare(`
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
        nowIso,
        row.id,
        row.batch_id,
        MAX_CERTIFICATE_RENDER_ATTEMPTS,
        staleBefore,
      ).run();

      if (changed(failure)) {
        failed += 1;
        reconciledBatchIds.add(row.batch_id);
      }
      continue;
    }

    const reservation = await env.DB.prepare(`
      UPDATE certificates
      SET enqueued_at = ?, updated_at = ?
      WHERE id = ? AND batch_id = ?
        AND (
          (
            status = 'pending'
            AND (enqueued_at IS NULL OR enqueued_at < ?)
          )
          OR (
            status = 'processing'
            AND (processing_started_at IS NULL OR processing_started_at < ?)
          )
        )
    `).bind(
      nowIso,
      nowIso,
      row.id,
      row.batch_id,
      staleBefore,
      staleBefore,
    ).run();

    if (!changed(reservation)) continue;

    try {
      await env.CERTIFICATE_QUEUE.send({
        kind: 'render_certificate',
        batchId: row.batch_id,
        certificateId: row.id,
      });
      requeued += 1;
    } catch (error) {
      await env.DB.prepare(`
        UPDATE certificates
        SET enqueued_at = NULL, updated_at = ?
        WHERE id = ? AND batch_id = ? AND enqueued_at = ?
      `).bind(
        new Date().toISOString(),
        row.id,
        row.batch_id,
        nowIso,
      ).run();
      throw error;
    }
  }

  const terminalCandidates = await env.DB.prepare(`
    SELECT cb.id
    FROM certificate_batches cb
    WHERE cb.status IN ('pending', 'processing')
      AND cb.updated_at < ?
      AND NOT EXISTS (
        SELECT 1
        FROM certificates c
        WHERE c.batch_id = cb.id
          AND c.status IN ('pending', 'processing')
      )
    ORDER BY cb.updated_at, cb.id
    LIMIT ?
  `).bind(staleBefore, RECOVERY_LIMIT).all<{ id: string }>();

  for (const candidate of terminalCandidates.results) {
    reconciledBatchIds.add(candidate.id);
  }

  for (const batchId of reconciledBatchIds) {
    await reconcileCertificateBatch(env, batchId);
  }

  return {
    requeued,
    failed,
    reconciledBatches: reconciledBatchIds.size,
  };
}
