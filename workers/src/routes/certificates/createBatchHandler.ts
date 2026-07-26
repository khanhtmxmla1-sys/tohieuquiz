import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { CreateCertificateBatchResult } from '../../../../shared/certificates.contract';
import { parseBatchRequest } from './batchRequest';
import { loadBatchScope } from './batchScope';
import { persistCertificateBatch } from './batchPersistence';
import { certificateError, certificateSuccess } from './responses';

export async function handleCreateBatch(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }
  const input = await parseBatchRequest(request);
  if (input instanceof Response) return input;
  const teacherId = authResult.user.id ?? authResult.user.username;
  const existing = await env.DB.prepare(`
    SELECT id, status FROM certificate_batches WHERE teacher_id = ? AND request_id = ?
  `).bind(teacherId, input.requestId).first<{
    id: string;
    status: CreateCertificateBatchResult['status'];
  }>();
  if (existing) {
    return certificateSuccess<CreateCertificateBatchResult>({
      batch_id: existing.id,
      status: existing.status,
    });
  }
  const scope = await loadBatchScope(env, authResult.user, input);
  if (scope instanceof Response) return scope;
  return persistCertificateBatch(env, teacherId, input, scope);
}
