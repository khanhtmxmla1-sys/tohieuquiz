import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';

export async function handleRetryBatch(request: Request, env: Env, batchId: string): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }

  const teacherId = authResult.user.id ?? authResult.user.username;
  const batch = await env.DB.prepare(`
    SELECT id FROM certificate_batches WHERE id = ? AND teacher_id = ?
  `).bind(batchId, teacherId).first();

  if (!batch) {
    return certificateError('CERTIFICATE_BATCH_NOT_FOUND', 'Batch not found', 404);
  }

  await env.DB.prepare(`
    UPDATE certificate_batches
    SET status = 'pending', error_message = NULL, updated_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), batchId).run();

  await env.DB.prepare(`
    UPDATE certificates
    SET status = 'pending', error_message = NULL, updated_at = ?
    WHERE batch_id = ? AND status = 'failed'
  `).bind(new Date().toISOString(), batchId).run();

  if (env.CERTIFICATE_QUEUE) {
    await env.CERTIFICATE_QUEUE.send({ batchId });
  }

  return certificateSuccess({ batch_id: batchId, status: 'pending' as const });
}

// GET /api/certificates/preview/:id
