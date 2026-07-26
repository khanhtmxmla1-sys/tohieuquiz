import type { Env } from '../types';
import type { FieldConfig } from '../types/certificates';
import type { CertificateNameFont } from '../../../shared/certificates.contract';
import { renderCertificate } from './certificateRenderer';
import { createParentNotification } from '../parentPortal/notificationService';
import { createNotification, createNotifications } from './notificationWriter';

const CERTIFICATE_RENDER_CONCURRENCY = 4;

export interface BatchStudent {
  certificate_id: string;
  student_id: string;
  student_name: string;
  student_score: number | null;
  quiz_title: string | null;
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
        return { ...field, prefix: '', format: undefined };
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
            date: dateLine !== null ? dateLine : new Date().toLocaleDateString('vi-VN'),
            teacher_name: teacherName,
            custom_note: message,
          },
        });

        const r2Key = `certs/${student.certificate_id}.png`;
        await env.CERT_IMAGES.put(r2Key, pngBuffer, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { certificateId: student.certificate_id, batchId },
        });

        const now = new Date().toISOString();
        const authenticatedImagePath = `/api/certificates/${student.certificate_id}/image`;
        await env.DB.prepare(`
          UPDATE certificates
          SET image_url = ?, png_r2_key = ?, status = 'sent', sent_at = ?,
              error_message = NULL, updated_at = ?
          WHERE id = ? AND batch_id = ? AND status = 'processing'
        `).bind(
          authenticatedImagePath,
          r2Key,
          now,
          now,
          student.certificate_id,
          batchId,
        ).run();
        successfulCertificateIds.add(student.certificate_id);
      } catch (error) {
        console.error(`[CertificateProcessor] render failed certificate=${student.certificate_id}`, error);
        await env.DB.prepare(`
          UPDATE certificates
          SET status = 'failed', error_message = ?, updated_at = ?
          WHERE id = ? AND batch_id = ?
        `).bind(
          error instanceof Error ? error.message : String(error),
          new Date().toISOString(),
          student.certificate_id,
          batchId,
        ).run();
      }
    });

    const successCount = successfulCertificateIds.size;
    const finalStatus = successCount === students.length
      ? 'sent'
      : successCount === 0
        ? 'failed'
        : 'partial';
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE certificate_batches
      SET status = ?, sent_at = ?, processing_started_at = NULL,
          error_message = NULL, updated_at = ?
      WHERE id = ?
    `).bind(finalStatus, successCount > 0 ? now : null, now, batchId).run();

    try {
      const batch = await env.DB.prepare(
        'SELECT teacher_id FROM certificate_batches WHERE id = ?',
      ).bind(batchId).first<{ teacher_id: string }>();
      if (batch?.teacher_id) {
        await createNotification(env.DB, {
          userId: batch.teacher_id,
          userRole: 'teacher',
          type: 'certificate_batch_completed',
          priority: finalStatus === 'sent' ? 'INFO' : 'IMPORTANT',
          title: 'Đợt cấp chứng nhận đã hoàn tất',
          body: `${batchTitle}: ${successCount}/${students.length} chứng nhận được tạo thành công.`,
          actionUrl: `/teacher/certificates?batch=${encodeURIComponent(batchId)}`,
          data: {
            batch_id: batchId,
            status: finalStatus,
            success_count: successCount,
            total_count: students.length,
          },
          sourceType: 'certificate_batch',
          sourceId: batchId,
          createdAt: now,
        });
      }
    } catch (error) {
      console.error('[NotificationWriter] certificate_batch_completed failed', {
        batchId,
        error,
      });
    }

    try {
      await createNotifications(env.DB, students
        .filter((student) => successfulCertificateIds.has(student.certificate_id))
        .map((student) => ({
          userId: student.student_id,
          userRole: 'student' as const,
          type: 'certificate_issued' as const,
          priority: 'IMPORTANT' as const,
          title: 'Em có chứng nhận mới! 🎓',
          body: `Em vừa nhận được chứng nhận: ${batchTitle}`,
          actionUrl: `/student/certificates?certificate=${encodeURIComponent(student.certificate_id)}`,
          data: {
            batch_id: batchId,
            certificate_id: student.certificate_id,
          },
          sourceType: 'certificate',
          sourceId: student.certificate_id,
          createdAt: now,
        })));
    } catch (error) {
      console.error('[NotificationWriter] certificate_issued failed', {
        batchId,
        error,
      });
    }

    for (const student of students) {
      if (!successfulCertificateIds.has(student.certificate_id)) continue;
      try {
        await createParentNotification(env.DB, {
          studentId: student.student_id,
          kind: 'certificate_issued',
          sourceType: 'certificate',
          sourceId: student.certificate_id,
          title: 'Con có chứng nhận mới',
          body: `Đã nhận chứng nhận: ${batchTitle}`,
          payload: { certificateId: student.certificate_id, batchId },
          publishedAt: now,
        });
      } catch (error) {
        console.error(`[CertificateProcessor] parent notification failed certificate=${student.certificate_id}`, error);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(`
      UPDATE certificate_batches
      SET status = 'failed', processing_started_at = NULL,
          error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(errorMessage, new Date().toISOString(), batchId).run();
    throw error;
  }
}
