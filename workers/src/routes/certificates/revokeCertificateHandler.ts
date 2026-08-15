import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';

export async function handleRevokeCertificate(request: Request, env: Env, certId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);

  const teacherId = authResult.user.id ?? authResult.user.username;
  const cert = await env.DB.prepare(`
    SELECT c.id, c.status, cb.teacher_id
    FROM certificates c
    JOIN certificate_batches cb ON cb.id = c.batch_id
    WHERE c.id = ? AND cb.teacher_id = ?
  `).bind(certId, teacherId).first<{ id: string; status: string; teacher_id: string }>();

  if (!cert) return certificateError('CERTIFICATE_NOT_FOUND', 'Certificate not found', 404);
  if (cert.status === 'revoked') return certificateSuccess({ id: cert.id, status: 'revoked' as const });
  if (cert.status !== 'sent') {
    return certificateError('CERTIFICATE_REVOKE_INVALID_STATE', 'Only a sent certificate can be revoked', 409);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE certificates
    SET status = 'revoked', updated_at = ?
    WHERE id = ? AND status = 'sent'
  `).bind(now, certId).run();

  return certificateSuccess({ id: cert.id, status: 'revoked' as const });
}
