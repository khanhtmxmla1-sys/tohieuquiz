import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { CertificateBatchSummary } from '../../../../shared/certificates.contract';
import { certificateError, certificateSuccess } from './responses';

export async function handleGetBatches(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }

  const teacherId = authResult.user.id ?? authResult.user.username;
  const { results } = await env.DB.prepare(`
    SELECT
      cb.id,
      cb.title,
      cb.message,
      cb.status,
      ct.name AS template_name,
      COUNT(c.id) AS total_certificates,
      SUM(CASE WHEN c.status = 'sent' THEN 1 ELSE 0 END) AS sent_certificates,
      SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed_certificates,
      cb.created_at,
      cb.sent_at
    FROM certificate_batches cb
    LEFT JOIN certificate_templates ct ON ct.id = cb.template_id
    LEFT JOIN certificates c ON c.batch_id = cb.id
    WHERE cb.teacher_id = ?
    GROUP BY cb.id
    ORDER BY cb.created_at DESC
  `).bind(teacherId).all<CertificateBatchSummary>();

  return certificateSuccess(results);
}

// GET /api/certificate-batches/:id
