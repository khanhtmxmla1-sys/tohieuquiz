import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { StudentCertificateItem } from '../../../../shared/certificates.contract';
import { certificateError, certificateSuccess } from './responses';

export async function handleGetMyCertificates(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (authResult.user.role !== 'student' || !authResult.user.id) {
    return certificateError('CERTIFICATE_STUDENT_REQUIRED', 'Student role required', 403);
  }

  const { results } = await env.DB.prepare(`
    SELECT
      c.id,
      c.batch_id,
      cb.title,
      t.full_name AS teacher_name,
      c.student_score,
      c.quiz_title,
      c.image_url,
      c.issued_at,
      c.sent_at,
      c.status
    FROM certificates c
    JOIN certificate_batches cb ON c.batch_id = cb.id
    JOIN teachers t ON cb.teacher_id = t.username
    WHERE c.student_id = ? AND c.status = 'sent'
    ORDER BY c.sent_at DESC, c.issued_at DESC
  `).bind(authResult.user.id).all<StudentCertificateItem>();

  return certificateSuccess(results);
}

// GET /api/certificates/notifications
