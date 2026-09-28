import type { Env } from '../types';
import { finalizeCertificateBatch } from './certificateBatchProcessor';

export type CertificateBatchStatus = 'pending' | 'processing' | 'sent' | 'partial' | 'failed';

interface CertificateBatchRow {
  title: string;
  status: CertificateBatchStatus;
  sent_at: string | null;
}

interface CertificateBatchCounts {
  total_count: number | null;
  pending_count: number | null;
  processing_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
}

function count(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function targetStatus(counts: CertificateBatchCounts): Exclude<CertificateBatchStatus, 'pending'> {
  const total = count(counts.total_count);
  const pending = count(counts.pending_count);
  const processing = count(counts.processing_count);
  const sent = count(counts.sent_count);

  if (pending + processing > 0) return 'processing';
  if (total > 0 && sent === total) return 'sent';
  if (sent > 0) return 'partial';
  return 'failed';
}

export async function reconcileCertificateBatch(
  env: Env,
  batchId: string,
): Promise<CertificateBatchStatus> {
  const batch = await env.DB.prepare(`
    SELECT title, status, sent_at
    FROM certificate_batches
    WHERE id = ?
  `).bind(batchId).first<CertificateBatchRow>();

  if (!batch) throw new Error(`Certificate batch ${batchId} not found`);

  const counts = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
    FROM certificates
    WHERE batch_id = ?
  `).bind(batchId).first<CertificateBatchCounts>();

  const normalizedCounts: CertificateBatchCounts = counts ?? {
    total_count: 0,
    pending_count: 0,
    processing_count: 0,
    sent_count: 0,
    failed_count: 0,
  };
  const status = targetStatus(normalizedCounts);
  const now = new Date().toISOString();

  if (status === 'processing') {
    await env.DB.prepare(`
      UPDATE certificate_batches
      SET status = 'processing', error_message = NULL, updated_at = ?
      WHERE id = ? AND status IN ('pending', 'processing')
    `).bind(now, batchId).run();
    return status;
  }

  const transition = await env.DB.prepare(`
    UPDATE certificate_batches
    SET status = ?,
        sent_at = CASE WHEN ? IN ('sent', 'partial') THEN COALESCE(sent_at, ?) ELSE NULL END,
        processing_started_at = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE id = ? AND status IN ('pending', 'processing')
  `).bind(status, status, now, now, batchId).run();

  const transitioned = Number(transition.meta?.changes ?? 0) > 0;
  const alreadyTerminal = batch.status === status && (
    status === 'sent' || status === 'partial' || status === 'failed'
  );

  if (transitioned || alreadyTerminal) {
    await finalizeCertificateBatch(
      env,
      batchId,
      batch.title,
      count(normalizedCounts.total_count),
      batch.sent_at || now,
      status,
    );
  }

  return status;
}
