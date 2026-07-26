import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';

export async function handleGetBatchDetail(request: Request, env: Env, batchId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }

  const teacherId = authResult.user.id ?? authResult.user.username;
  const batch = await env.DB.prepare(`
    SELECT cb.*, ct.name AS template_name,
      COUNT(c.id) AS total_certificates,
      SUM(CASE WHEN c.status = 'sent' THEN 1 ELSE 0 END) AS sent_certificates,
      SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed_certificates
    FROM certificate_batches cb
    LEFT JOIN certificate_templates ct ON ct.id = cb.template_id
    LEFT JOIN certificates c ON c.batch_id = cb.id
    WHERE cb.id = ? AND cb.teacher_id = ?
    GROUP BY cb.id
  `).bind(batchId, teacherId).first();

  if (!batch) {
    return certificateError('CERTIFICATE_BATCH_NOT_FOUND', 'Batch not found', 404);
  }

  const { results: certificates } = await env.DB.prepare(`
    SELECT c.*, COALESCE(NULLIF(c.student_name, ''), s.full_name) AS student_name
    FROM certificates c
    LEFT JOIN students s ON c.student_id = s.id
    WHERE c.batch_id = ?
    ORDER BY c.issued_at DESC
  `).bind(batchId).all();

  return certificateSuccess({ batch, certificates });
}

// POST /api/certificate-batches/:id/retry
