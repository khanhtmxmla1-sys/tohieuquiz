import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { CertificatePreviewItem } from '../../../../shared/certificates.contract';
import { certificateError, certificateSuccess } from './responses';

export async function handleCertificatePreview(request: Request, env: Env, certId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;

  const cert = await env.DB.prepare(`
    SELECT c.id, c.batch_id, cb.title, cb.template_id, cb.teacher_id,
      c.student_id, COALESCE(NULLIF(c.student_name, ''), s.full_name) AS student_name,
      c.student_score, c.quiz_title, c.image_url, c.issued_at, c.sent_at, c.status
    FROM certificates c
    JOIN certificate_batches cb ON c.batch_id = cb.id
    LEFT JOIN students s ON c.student_id = s.id
    WHERE c.id = ?
  `).bind(certId).first<CertificatePreviewItem & { teacher_id: string }>();

  if (!cert) return certificateError('CERTIFICATE_NOT_FOUND', 'Certificate not found', 404);

  const requesterId = authResult.user.id ?? authResult.user.username;
  const canPreview = authResult.user.role === 'admin'
    || (authResult.user.role === 'teacher' && cert.teacher_id === requesterId)
    || (authResult.user.role === 'student' && cert.student_id === authResult.user.id && cert.status !== 'revoked');
  if (!canPreview) return certificateError('CERTIFICATE_PREVIEW_FORBIDDEN', 'Certificate is outside your scope', 403);

  const dto: CertificatePreviewItem = {
    id: cert.id,
    batch_id: cert.batch_id,
    title: cert.title,
    template_id: cert.template_id,
    student_id: cert.student_id,
    student_name: cert.student_name,
    student_score: cert.student_score,
    quiz_title: cert.quiz_title,
    image_url: cert.image_url,
    issued_at: cert.issued_at,
    sent_at: cert.sent_at,
    status: cert.status,
  };
  return certificateSuccess(dto);
}

// GET /api/certificates/:id/image
