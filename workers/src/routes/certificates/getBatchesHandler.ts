import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { CertificateBatchPage, CertificateBatchSummary } from '../../../../shared/certificates.contract';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../../utils/cursorPagination';
import { certificateError, certificateSuccess } from './responses';

export async function handleGetBatches(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);

  const url = new URL(request.url);
  let limit: number;
  let cursor: string[] | null;
  try {
    limit = collectionLimit(url);
    cursor = decodeCollectionCursor(url.searchParams.get('cursor'), 'certificate-batches', 2);
  } catch (error) {
    return certificateError('CERTIFICATE_PAGINATION_INVALID', error instanceof Error ? error.message : 'Pagination invalid', 400);
  }

  const teacherId = authResult.user.id ?? authResult.user.username;
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM certificate_batches WHERE teacher_id = ?')
    .bind(teacherId).first<{ total: number }>();
  const where = ['cb.teacher_id = ?'];
  const bindings: unknown[] = [teacherId];
  if (cursor) {
    where.push('(cb.created_at < ? OR (cb.created_at = ? AND cb.id < ?))');
    bindings.push(cursor[0], cursor[0], cursor[1]);
  }
  const { results } = await env.DB.prepare(`
    SELECT cb.id, cb.title, cb.message, cb.status, ct.name AS template_name,
      COUNT(c.id) AS total_certificates,
      SUM(CASE WHEN c.status = 'sent' THEN 1 ELSE 0 END) AS sent_certificates,
      SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed_certificates,
      cb.created_at, cb.sent_at
    FROM certificate_batches cb
    LEFT JOIN certificate_templates ct ON ct.id = cb.template_id
    LEFT JOIN certificates c ON c.batch_id = cb.id
    WHERE ${where.join(' AND ')}
    GROUP BY cb.id
    ORDER BY cb.created_at DESC, cb.id DESC
    LIMIT ?
  `).bind(...bindings, limit + 1).all<CertificateBatchSummary>();

  const source = results ?? [];
  const items = source.slice(0, limit);
  const last = items.at(-1);
  const hasMore = source.length > limit;
  const page: CertificateBatchPage = {
    items,
    meta: {
      limit,
      total: Number(count?.total ?? 0),
      hasMore,
      nextCursor: hasMore && last ? encodeCollectionCursor('certificate-batches', [last.created_at, last.id]) : null,
    },
  };
  return certificateSuccess(page);
}

// GET /api/certificate-batches/:id
