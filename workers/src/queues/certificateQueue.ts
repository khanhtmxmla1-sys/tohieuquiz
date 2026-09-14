import type { Env } from '../types';
import type { BatchStudent } from '../services/certificateBatchProcessor';
import { finalizeCertificateBatch, processBatch } from '../services/certificateBatchProcessor';
import type { CertificateNameFont } from '../../../shared/certificates.contract';

const MAX_QUEUE_ATTEMPTS = 3;
const PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

export interface CertificateQueueMessage {
  batchId: string;
}

interface QueueBatchRow {
  id: string;
  teacher_id: string;
  template_id: string;
  title: string;
  message: string | null;
  achievement_prefix: string | null;
  date_line: string | null;
  student_name_font: CertificateNameFont | null;
  status: 'pending' | 'processing' | 'sent' | 'partial' | 'failed';
  processing_started_at: string | null;
}

interface RawCertificateCounts {
  total_count: number | null;
  pending_count: number | null;
  processing_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
}

interface CurrentBatchLease {
  status: QueueBatchRow['status'];
  processing_started_at: string | null;
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 30 * (2 ** Math.max(0, attempt - 1)));
}

function leaseRetryDelaySeconds(processingStartedAt: string | null): number {
  const startedAtMs = processingStartedAt ? Date.parse(processingStartedAt) : Number.NaN;
  if (!Number.isFinite(startedAtMs)) return 60;
  const remainingMs = PROCESSING_STALE_AFTER_MS - (Date.now() - startedAtMs);
  return Math.max(1, Math.ceil(Math.max(0, remainingMs) / 1000) + 1);
}

function hasChanges(result: { meta?: { changes?: number } } | null | undefined): boolean {
  return Number(result?.meta?.changes || 0) === 1;
}

async function retryAfterCurrentLease(
  env: Env,
  queueMessage: Message<CertificateQueueMessage>,
  batchId: string,
): Promise<void> {
  const current = await env.DB.prepare(`
    SELECT status, processing_started_at
    FROM certificate_batches WHERE id = ?
  `).bind(batchId).first<CurrentBatchLease>();
  if (current?.status === 'sent' || current?.status === 'partial') {
    queueMessage.ack();
    return;
  }
  queueMessage.retry({ delaySeconds: leaseRetryDelaySeconds(current?.processing_started_at ?? null) });
}

interface CertificateCounts {
  total_count: number;
  pending_count: number;
  processing_count: number;
  sent_count: number;
  failed_count: number;
}

async function loadCertificateCounts(env: Env, batchId: string): Promise<CertificateCounts> {
  const counts = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
    FROM certificates
    WHERE batch_id = ?
  `).bind(batchId).first<RawCertificateCounts>();
  return {
    total_count: Number(counts?.total_count || 0),
    pending_count: Number(counts?.pending_count || 0),
    processing_count: Number(counts?.processing_count || 0),
    sent_count: Number(counts?.sent_count || 0),
    failed_count: Number(counts?.failed_count || 0),
  };
}

function certificateOwnershipPredicate(): string {
  return `
    AND EXISTS (
      SELECT 1 FROM certificate_batches owner_batch
      WHERE owner_batch.id = certificates.batch_id
        AND owner_batch.status = 'processing'
        AND owner_batch.processing_started_at = ?
    )`;
}

export default {
  async queue(batch: MessageBatch<CertificateQueueMessage>, env: Env, _ctx: ExecutionContext) {
    console.log(`[CertQueue] messages=${batch.messages.length}`);

    for (const queueMessage of batch.messages) {
      const { batchId } = queueMessage.body;
      let claimedProcessingStartedAt: string | null = null;

      try {
        const batchRow = await env.DB.prepare(`
          SELECT id, teacher_id, template_id, title, message, achievement_prefix, date_line,
                 student_name_font,
                 status, processing_started_at
          FROM certificate_batches WHERE id = ?
        `).bind(batchId).first<QueueBatchRow>();

        if (!batchRow) {
          console.error(`[CertQueue] missing batch=${batchId}`);
          queueMessage.ack();
          continue;
        }

        if (batchRow.status === 'sent' || batchRow.status === 'partial') {
          const counts = await loadCertificateCounts(env, batchId);
          await finalizeCertificateBatch(
            env, batchId, batchRow.title, counts.total_count,
            new Date().toISOString(), batchRow.status,
          );
          queueMessage.ack();
          continue;
        }

        if (batchRow.status === 'processing' && batchRow.processing_started_at) {
          const processingAge = Date.now() - new Date(batchRow.processing_started_at).getTime();
          if (Number.isFinite(processingAge) && processingAge < PROCESSING_STALE_AFTER_MS) {
            queueMessage.retry({ delaySeconds: leaseRetryDelaySeconds(batchRow.processing_started_at) });
            continue;
          }
        }

        const observedStatus = batchRow.status;
        const observedProcessingStartedAt = batchRow.processing_started_at;
        claimedProcessingStartedAt = new Date().toISOString();
        const claimResult = await env.DB.prepare(`
          UPDATE certificate_batches
          SET status = 'processing', attempt_count = attempt_count + 1,
              processing_started_at = ?, error_message = NULL, updated_at = ?
          WHERE id = ? AND status = ? AND processing_started_at IS ?
        `).bind(
          claimedProcessingStartedAt,
          claimedProcessingStartedAt,
          batchId,
          observedStatus,
          observedProcessingStartedAt,
        ).run();
        if (!hasChanges(claimResult)) {
          await retryAfterCurrentLease(env, queueMessage, batchId);
          continue;
        }

        await env.DB.prepare(`
          UPDATE certificates
          SET status = 'pending', updated_at = ?
          WHERE batch_id = ? AND status = 'processing'
          ${certificateOwnershipPredicate()}
        `).bind(new Date().toISOString(), batchId, claimedProcessingStartedAt).run();

        const { results: certificateRows } = await env.DB.prepare(`
          SELECT c.id AS certificate_id, c.student_id,
                 COALESCE(NULLIF(c.student_name, ''), s.full_name) AS student_name,
                 c.student_score, c.quiz_title
          FROM certificates c
          LEFT JOIN students s ON s.id = c.student_id
          WHERE c.batch_id = ? AND c.status = 'pending'
          ORDER BY c.issued_at
        `).bind(batchId).all<BatchStudent>();

        if (certificateRows.length === 0) {
          const counts = await loadCertificateCounts(env, batchId);
          const finalStatus = counts.total_count > 0 && counts.sent_count === counts.total_count
            ? 'sent'
            : counts.sent_count > 0
              ? 'partial'
              : 'failed';
          const finalizedAt = new Date().toISOString();
          const finalization = await env.DB.prepare(`
            UPDATE certificate_batches
            SET status = ?, sent_at = CASE WHEN ? IN ('sent', 'partial') THEN COALESCE(sent_at, ?) ELSE sent_at END,
                processing_started_at = NULL,
                error_message = CASE WHEN ? = 'failed' THEN 'No pending certificates to process' ELSE NULL END,
                updated_at = ?
            WHERE id = ? AND status = 'processing' AND processing_started_at = ?
          `).bind(
            finalStatus,
            finalStatus,
            finalizedAt,
            finalStatus,
            finalizedAt,
            batchId,
            claimedProcessingStartedAt,
          ).run();
          if (!hasChanges(finalization)) {
            await retryAfterCurrentLease(env, queueMessage, batchId);
            continue;
          }
          if (finalStatus === 'sent' || finalStatus === 'partial') {
            await finalizeCertificateBatch(env, batchId, batchRow.title, counts.total_count, finalizedAt, finalStatus);
          }
          queueMessage.ack();
          continue;
        }

        const teacher = await env.DB.prepare(
          'SELECT full_name FROM teachers WHERE username = ?',
        ).bind(batchRow.teacher_id).first<{ full_name: string }>();
        const now = new Date().toISOString();

        await env.DB.prepare(`
          UPDATE certificates
          SET status = 'processing', attempt_count = attempt_count + 1, updated_at = ?
          WHERE batch_id = ? AND status = 'pending'
          ${certificateOwnershipPredicate()}
        `).bind(now, batchId, claimedProcessingStartedAt).run();

        await processBatch(
          env,
          batchId,
          batchRow.template_id,
          certificateRows,
          teacher?.full_name || 'GiÃ¡o viÃªn',
          batchRow.title,
          batchRow.message || '',
          batchRow.achievement_prefix,
          batchRow.date_line,
          batchRow.student_name_font,
          claimedProcessingStartedAt,
        );

        queueMessage.ack();
        console.log(`[CertQueue] completed batch=${batchId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[CertQueue] failed batch=${batchId} attempt=${queueMessage.attempts}`, error);
        if (queueMessage.attempts < MAX_QUEUE_ATTEMPTS) {
          const now = new Date().toISOString();
          if (claimedProcessingStartedAt !== null) {
            await env.DB.batch([
              env.DB.prepare(`
                UPDATE certificates
                SET status = 'pending', error_message = ?, updated_at = ?
                WHERE batch_id = ? AND status = 'processing'
                ${certificateOwnershipPredicate()}
              `).bind(errorMessage, now, batchId, claimedProcessingStartedAt),
              env.DB.prepare(`
                UPDATE certificate_batches
                SET status = 'pending', processing_started_at = NULL,
                    error_message = ?, updated_at = ?
                WHERE id = ? AND status = 'processing' AND processing_started_at = ?
              `).bind(errorMessage, now, batchId, claimedProcessingStartedAt),
            ]).catch(() => undefined);
          }
          queueMessage.retry({ delaySeconds: retryDelaySeconds(queueMessage.attempts) });
          continue;
        }

        const now = new Date().toISOString();
        if (claimedProcessingStartedAt !== null) {
          await env.DB.batch([
            env.DB.prepare(`
              UPDATE certificates
              SET status = 'failed', error_message = ?, updated_at = ?
              WHERE batch_id = ? AND status = 'processing'
                ${certificateOwnershipPredicate()}
              `).bind(errorMessage, now, batchId, claimedProcessingStartedAt),
            env.DB.prepare(`
              UPDATE certificate_batches
              SET status = 'failed', processing_started_at = NULL,
                  error_message = ?, updated_at = ?
              WHERE id = ? AND status = 'processing' AND processing_started_at = ?
            `).bind(errorMessage, now, batchId, claimedProcessingStartedAt),
          ]).catch(() => undefined);
        }
        queueMessage.retry({ delaySeconds: retryDelaySeconds(queueMessage.attempts) });
      }
    }
  },
};
