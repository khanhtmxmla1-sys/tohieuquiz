import type { Env } from '../../types';
import type { CreateCertificateBatchResult } from '../../../../shared/certificates.contract';
import { normalizeLookupText } from './normalize';
import { certificateSuccess } from './responses';
import type { BatchInput, BatchScope } from './batchTypes';

export async function persistCertificateBatch(
  env: Env,
  teacherId: string,
  input: BatchInput,
  scope: BatchScope,
): Promise<Response> {
  const batchId = `batch-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [env.DB.prepare(`
    INSERT INTO certificate_batches (
      id, teacher_id, request_id, class_id, quiz_id, template_id, title, message,
      achievement_prefix, date_line, student_name_font, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).bind(
    batchId, teacherId, input.requestId, input.classId, input.quizId, input.templateId,
    input.title, input.message, input.achievementPrefix, input.dateLine, input.studentNameFont, now, now,
  )];

  for (const student of scope.roster) {
    const result = scope.latestResultByName.get(normalizeLookupText(student.full_name));
    statements.push(env.DB.prepare(`
      INSERT INTO certificates (
        id, batch_id, student_id, student_name, student_score, quiz_title,
        status, issued_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      `cert-${crypto.randomUUID()}`, batchId, student.id, student.full_name,
      result?.score ?? null, result?.quiz_title ?? scope.quiz?.title ?? null, now, now,
    ));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const racedBatch = await env.DB.prepare(`
      SELECT id, status FROM certificate_batches WHERE teacher_id = ? AND request_id = ?
    `).bind(teacherId, input.requestId).first<{
      id: string;
      status: CreateCertificateBatchResult['status'];
    }>();
    if (racedBatch) {
      return certificateSuccess<CreateCertificateBatchResult>({
        batch_id: racedBatch.id,
        status: racedBatch.status,
      });
    }
    throw error;
  }
  if (env.CERTIFICATE_QUEUE) await env.CERTIFICATE_QUEUE.send({ batchId });
  return certificateSuccess<CreateCertificateBatchResult>({
    batch_id: batchId,
    status: 'pending',
  }, 201);
}
