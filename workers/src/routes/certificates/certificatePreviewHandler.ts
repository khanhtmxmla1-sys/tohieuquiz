import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';

export async function handleCertificatePreview(request: Request, env: Env, certId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;

  const cert = await env.DB.prepare(`
    SELECT c.*, cb.title, cb.template_id, cb.teacher_id,
      COALESCE(NULLIF(c.student_name, ''), s.full_name) AS student_name
    FROM certificates c
    JOIN certificate_batches cb ON c.batch_id = cb.id
    LEFT JOIN students s ON c.student_id = s.id
    WHERE c.id = ?
  `).bind(certId).first<{
    student_id: string;
    teacher_id: string;
    status: string;
    [key: string]: unknown;
  }>();

  if (!cert) {
    return certificateError('CERTIFICATE_NOT_FOUND', 'Certificate not found', 404);
  }

  const requesterId = authResult.user.id ?? authResult.user.username;
  const canPreview = authResult.user.role === 'admin'
    || (authResult.user.role === 'teacher' && cert.teacher_id === requesterId)
    || (authResult.user.role === 'student'
      && cert.student_id === authResult.user.id
      && cert.status !== 'revoked');
  if (!canPreview) {
    return certificateError('CERTIFICATE_PREVIEW_FORBIDDEN', 'Certificate is outside your scope', 403);
  }

  return certificateSuccess(cert);
}

// GET /api/certificates/:id/image
