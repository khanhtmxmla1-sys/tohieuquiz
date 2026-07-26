import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError } from './responses';

export async function handleGetCertificateImage(request: Request, env: Env, certId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;

  const cert = await env.DB.prepare(`
    SELECT c.student_id, c.status, c.png_r2_key, cb.teacher_id
    FROM certificates c
    JOIN certificate_batches cb ON c.batch_id = cb.id
    WHERE c.id = ?
  `).bind(certId).first<{
    student_id: string;
    status: string;
    png_r2_key: string | null;
    teacher_id: string;
  }>();

  if (!cert) {
    return certificateError('CERTIFICATE_NOT_FOUND', 'Certificate not found', 404);
  }

  const requesterId = authResult.user.id ?? authResult.user.username;
  const canRead = authResult.user.role === 'admin'
    || (authResult.user.role === 'teacher' && cert.teacher_id === requesterId)
    || (authResult.user.role === 'student' && cert.student_id === authResult.user.id);
  if (!canRead) {
    return certificateError('CERTIFICATE_IMAGE_FORBIDDEN', 'Certificate image is outside your scope', 403);
  }
  if (cert.status !== 'sent' || !cert.png_r2_key) {
    return certificateError('CERTIFICATE_IMAGE_NOT_READY', 'Certificate image is not ready', 409);
  }

  const image = await env.CERT_IMAGES.get(cert.png_r2_key);
  if (!image) {
    return certificateError('CERTIFICATE_IMAGE_NOT_FOUND', 'Certificate image not found', 404);
  }

  return new Response(image.body, {
    headers: {
      'Content-Type': image.httpMetadata?.contentType ?? 'image/png',
      'Cache-Control': 'private, no-store',
      ETag: image.httpEtag,
    },
  });
}

// Legacy teacher template upload was incompatible with the canonical schema.
// Template mutation remains under /api/admin/certificate-templates.
