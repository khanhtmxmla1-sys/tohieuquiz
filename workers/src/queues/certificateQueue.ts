import type { Env } from '../types';
import type { BatchStudent } from '../services/certificateBatchProcessor';
import { processBatch } from '../services/certificateBatchProcessor';
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

function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 30 * (2 ** Math.max(0, attempt - 1)));
}

export default {
  async queue(batch: MessageBatch<CertificateQueueMessage>, env: Env, _ctx: ExecutionContext) {
    console.log(`[CertQueue] messages=${batch.messages.length}`);

    for (const queueMessage of batch.messages) {
      const { batchId } = queueMessage.body;

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
          queueMessage.ack();
          continue;
        }

        if (batchRow.status === 'processing' && batchRow.processing_started_at) {
          const processingAge = Date.now() - new Date(batchRow.processing_started_at).getTime();
          if (Number.isFinite(processingAge) && processingAge < PROCESSING_STALE_AFTER_MS) {
            queueMessage.retry({ delaySeconds: 60 });
            continue;
          }
          await env.DB.prepare(`
            UPDATE certificates
            SET status = 'pending', updated_at = ?
            WHERE batch_id = ? AND status = 'processing'
          `).bind(new Date().toISOString(), batchId).run();
        }

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
          await env.DB.prepare(`
            UPDATE certificate_batches
            SET status = 'failed', processing_started_at = NULL,
                error_message = 'No pending certificates to process', updated_at = ?
            WHERE id = ?
          `).bind(new Date().toISOString(), batchId).run();
          queueMessage.ack();
          continue;
        }

        const teacher = await env.DB.prepare(
          'SELECT full_name FROM teachers WHERE username = ?',
        ).bind(batchRow.teacher_id).first<{ full_name: string }>();
        const now = new Date().toISOString();

        await env.DB.batch([
          env.DB.prepare(`
            UPDATE certificate_batches
            SET status = 'processing', attempt_count = attempt_count + 1,
                processing_started_at = ?, error_message = NULL, updated_at = ?
            WHERE id = ?
          `).bind(now, now, batchId),
          env.DB.prepare(`
            UPDATE certificates
            SET status = 'processing', attempt_count = attempt_count + 1, updated_at = ?
            WHERE batch_id = ? AND status = 'pending'
          `).bind(now, batchId),
        ]);

        await processBatch(
          env,
          batchId,
          batchRow.template_id,
          certificateRows,
          teacher?.full_name || 'Giáo viên',
          batchRow.title,
          batchRow.message || '',
          batchRow.achievement_prefix,
          batchRow.date_line,
          batchRow.student_name_font,
        );

        queueMessage.ack();
        console.log(`[CertQueue] completed batch=${batchId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[CertQueue] failed batch=${batchId} attempt=${queueMessage.attempts}`, error);

        if (queueMessage.attempts < MAX_QUEUE_ATTEMPTS) {
          const now = new Date().toISOString();
          await env.DB.batch([
            env.DB.prepare(`
              UPDATE certificate_batches
              SET status = 'pending', processing_started_at = NULL,
                  error_message = ?, updated_at = ?
              WHERE id = ?
            `).bind(errorMessage, now, batchId),
            env.DB.prepare(`
              UPDATE certificates
              SET status = 'pending', error_message = ?, updated_at = ?
              WHERE batch_id = ? AND status = 'processing'
            `).bind(errorMessage, now, batchId),
          ]).catch(() => undefined);
          queueMessage.retry({ delaySeconds: retryDelaySeconds(queueMessage.attempts) });
          continue;
        }

        const now = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE certificate_batches
            SET status = 'failed', processing_started_at = NULL,
                error_message = ?, updated_at = ?
            WHERE id = ?
          `).bind(errorMessage, now, batchId),
          env.DB.prepare(`
            UPDATE certificates
            SET status = 'failed', error_message = ?, updated_at = ?
            WHERE batch_id = ? AND status = 'processing'
          `).bind(errorMessage, now, batchId),
        ]).catch(() => undefined);
        queueMessage.ack();
      }
    }
  },
};
