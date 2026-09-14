import { formatSystemDate } from '../utils/systemTime';
import type { Env } from '../types';
import type { FieldConfig } from '../types/certificates';
import type { CertificateNameFont } from '../../../shared/certificates.contract';
import { renderCertificate } from './certificateRenderer';
import { createParentNotification } from '../parentPortal/notificationService';
import { createNotification, createNotifications } from './notificationWriter';

const CERTIFICATE_RENDER_CONCURRENCY = 1;

export interface BatchStudent {
  certificate_id: string;
  student_id: string;
  student_name: string;
  student_score: number | null;
  quiz_title: string | null;
}

interface SentCertificate {
  certificate_id: string;
  student_id: string;
  sent_at: string | null;
}

interface CertificateBatchCounts {
  total_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
}

function certificateOwnerPredicate(): string {
  return `
    AND EXISTS (
      SELECT 1 FROM certificate_batches owner_batch
      WHERE owner_batch.id = certificates.batch_id
        AND owner_batch.status = 'processing'
        AND owner_batch.processing_started_at = ?
    )`;
}

export async function finalizeCertificateBatch(
  env: Env,
  batchId: string,
  batchTitle: string,
  totalCount: number,
  terminalSentAt: string,
  finalStatus: 'sent' | 'partial' | 'failed' = 'sent',
): Promise<void> {
  const batch = await env.DB.prepare(`
    SELECT teacher_id, sent_at
    FROM certificate_batches WHERE id = ?
  `).bind(batchId).first<{ teacher_id: string; sent_at: string | null }>();
  const notificationTerminalAt = batch?.sent_at || terminalSentAt;
  const sentCertificates = await env.DB.prepare(`
    SELECT id AS certificate_id, student_id, sent_at
    FROM certificates
    WHERE batch_id = ? AND status = 'sent'
    ORDER BY issued_at, id
  `).bind(batchId).all<SentCertificate>();
  const sentCount = sentCertificates.results.length;

  try {
    if (batch?.teacher_id) {
      await createNotification(env.DB, {
        userId: batch.teacher_id,
        userRole: 'teacher',
        type: 'certificate_batch_completed',
        priority: finalStatus === 'sent' ? 'INFO' : 'IMPORTANT',
        title: 'Đợt cấp chứng nhận đã hoàn tất',
        body: `${batchTitle}: ${sentCount}/${totalCount} chứng nhận được tạo thành công.`,
        actionUrl: `/teacher/certificates?batch=${encodeURIComponent(batchId)}`,
        data: {
          batch_id: batchId,
          status: finalStatus,
          success_count: sentCount,
          total_count: totalCount,
        },
        sourceType: 'certificate_batch',
        sourceId: batchId,
        createdAt: notificationTerminalAt,
      });
    }
  } catch (error) {
    console.error('[NotificationWriter] certificate_batch_completed failed', {
      batchId,
      error,
    });
  }

  try {
    await createNotifications(env.DB, sentCertificates.results.map((certificate) => ({
      userId: certificate.student_id,
      userRole: 'student' as const,
      type: 'certificate_issued' as const,
      priority: 'IMPORTANT' as const,
      title: 'Em có chứng nhận mới! 🎓',
      body: `Em vừa nhận được chứng nhận: ${batchTitle}`,
      actionUrl: `/student/achievements?certificate=${encodeURIComponent(certificate.certificate_id)}`,
      data: {
        batch_id: batchId,
        certificate_id: certificate.certificate_id,
      },
      sourceType: 'certificate',
      sourceId: certificate.certificate_id,
      createdAt: certificate.sent_at || notificationTerminalAt,
    })));
  } catch (error) {
    console.error('[NotificationWriter] certificate_issued failed', {
      batchId,
      error,
    });
  }

  for (const certificate of sentCertificates.results) {
    try {
      await createParentNotification(env.DB, {
        studentId: certificate.student_id,
        kind: 'certificate_issued',
        sourceType: 'certificate',
        sourceId: certificate.certificate_id,
        title: 'Con có chứng nhận mới',
        body: `Đã nhận chứng nhận: ${batchTitle}`,
        payload: { certificateId: certificate.certificate_id, batchId },
        publishedAt: certificate.sent_at || notificationTerminalAt,
      });
    } catch (error) {
      console.error(`[CertificateProcessor] parent notification failed certificate=${certificate.certificate_id}`, error);
    }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
}

export async function processBatch(
  env: Env,
  batchId: string,
  templateId: string,
  students: BatchStudent[],
  teacherName: string,
  batchTitle: string,
  message: string,
  achievementPrefix: string | null = null,
  dateLine: string | null = null,
  studentNameFont: CertificateNameFont | null = null,
  processingStartedAt: string | null = null,
): Promise<void> {
  const successfulCertificateIds = new Set<string>();

  try {
    const template = await env.DB.prepare(
      'SELECT bg_image_r2_key, fields_config, canvas_width, canvas_height FROM certificate_templates WHERE id = ? AND is_active = 1',
    ).bind(templateId).first<{ bg_image_r2_key: string; fields_config: string; canvas_width: number; canvas_height: number }>();
    if (!template) throw new Error(`Active template ${templateId} not found`);

    const bgObject = await env.CERT_IMAGES.get(template.bg_image_r2_key);
    if (!bgObject) throw new Error(`Certificate background not found: ${template.bg_image_r2_key}`);

    const bgBuffer = await bgObject.arrayBuffer();
    let fieldsConfig: FieldConfig[];
    try {
      fieldsConfig = JSON.parse(template.fields_config || '[]') as FieldConfig[];
    } catch {
      throw new Error(`Invalid fields_config for template ${templateId}`);
    }
    const renderFieldsConfig = fieldsConfig.map((field) => {
      if (field.key === 'student_name' && studentNameFont !== null) {
        return { ...field, fontFamily: studentNameFont };
      }
      if (field.key === 'quiz_title' && achievementPrefix !== null) {
        return {
          ...field,
          prefix: achievementPrefix ? `${achievementPrefix} ` : '',
        };
      }
      if (field.key === 'date' && dateLine !== null) {
        return {
          ...field,
          fontSize: (field.fontSize ?? 32) + 1,
          fontStyle: 'italic' as const,
          prefix: '',
          format: undefined,
        };
      }
      return field;
    });

    await runWithConcurrency(students, CERTIFICATE_RENDER_CONCURRENCY, async (student) => {
      try {
        const pngBuffer = await renderCertificate({
          env,
          bgImageArrayBuffer: bgBuffer,
          fieldsConfig: renderFieldsConfig,
          width: template.canvas_width,
          height: template.canvas_height,
          data: {
            student_name: student.student_name,
            score: student.student_score !== null ? `${student.student_score}/10` : '',
            quiz_title: student.quiz_title || '',
            date: dateLine !== null ? dateLine : formatSystemDate(new Date()),
            teacher_name: teacherName,
            custom_note: message,
          },
        });

        // Each lease writes its own image; only the current owner can publish
        // the key in D1, so an expired renderer cannot overwrite a newer image.
        const r2Key = processingStartedAt === null
          ? `certs/${student.certificate_id}.png`
          : `certs/${student.certificate_id}/${encodeURIComponent(processingStartedAt)}.png`;
        await env.CERT_IMAGES.put(r2Key, pngBuffer, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { certificateId: student.certificate_id, batchId },
        });

        const now = new Date().toISOString();
        const authenticatedImagePath = `/api/certificates/${student.certificate_id}/image`;
        const certificateUpdate = await env.DB.prepare(`
          UPDATE certificates
          SET image_url = ?, png_r2_key = ?, status = 'sent', sent_at = ?,
              error_message = NULL, updated_at = ?
          WHERE id = ? AND batch_id = ? AND status = 'processing'
          ${processingStartedAt === null ? '' : certificateOwnerPredicate()}
        `).bind(
          authenticatedImagePath,
          r2Key,
          now,
          now,
          student.certificate_id,
          batchId,
          ...(processingStartedAt === null ? [] : [processingStartedAt]),
        ).run();
        if (Number(certificateUpdate.meta?.changes ?? 1) > 0) {
          successfulCertificateIds.add(student.certificate_id);
        }
      } catch (error) {
        console.error(`[CertificateProcessor] render failed certificate=${student.certificate_id}`, error);
        await env.DB.prepare(`
          UPDATE certificates
          SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ? AND batch_id = ? AND status = 'processing'
          ${processingStartedAt === null ? '' : certificateOwnerPredicate()}
        `).bind(
          error instanceof Error ? error.message : String(error),
          new Date().toISOString(),
          student.certificate_id,
          batchId,
          ...(processingStartedAt === null ? [] : [processingStartedAt]),
        ).run();
      }
    });

    const counts = await env.DB.prepare(`
      SELECT COUNT(*) AS total_count,
             SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
      FROM certificates WHERE batch_id = ?
    `).bind(batchId).first<CertificateBatchCounts>();
    const totalCount = Number(counts?.total_count ?? students.length);
    const successCount = Number(counts?.sent_count ?? successfulCertificateIds.size);
    const finalStatus = totalCount > 0 && successCount === totalCount
      ? 'sent'
      : successCount > 0
        ? 'partial'
        : 'failed';
    const now = new Date().toISOString();
    const finalization = await env.DB.prepare(`
      UPDATE certificate_batches
      SET status = ?,
          sent_at = CASE WHEN ? IN ('sent', 'partial') THEN COALESCE(sent_at, ?) ELSE NULL END,
          processing_started_at = NULL,
          error_message = NULL, updated_at = ?
      WHERE id = ? AND status = 'processing'
      ${processingStartedAt === null ? '' : 'AND processing_started_at = ?'}
    `).bind(
      finalStatus,
      finalStatus,
      now,
      now,
      batchId,
      ...(processingStartedAt === null ? [] : [processingStartedAt]),
    ).run();
    if (Number(finalization.meta?.changes ?? 1) === 0) return;
    await finalizeCertificateBatch(env, batchId, batchTitle, totalCount, now, finalStatus);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (processingStartedAt === null) {
      await env.DB.prepare(`
        UPDATE certificate_batches
        SET status = 'failed', processing_started_at = NULL,
            error_message = ?, updated_at = ?
        WHERE id = ? AND status = 'processing'
      `).bind(errorMessage, new Date().toISOString(), batchId).run();
    }
    throw error;
  }
}
