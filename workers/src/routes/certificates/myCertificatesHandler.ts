import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { CertificateListPage, StudentCertificateItem } from '../../../../shared/certificates.contract';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../../utils/cursorPagination';
import { certificateError, certificateSuccess } from './responses';

export async function handleGetMyCertificates(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (authResult.user.role !== 'student' || !authResult.user.id) {
    return certificateError('CERTIFICATE_STUDENT_REQUIRED', 'Student role required', 403);
  }

  const url = new URL(request.url);
  let limit: number;
  let cursor: string[] | null;
  try {
    limit = collectionLimit(url);
    cursor = decodeCollectionCursor(url.searchParams.get('cursor'), 'student-certificates', 2);
  } catch (error) {
    return certificateError('CERTIFICATE_PAGINATION_INVALID', error instanceof Error ? error.message : 'Pagination invalid', 400);
  }

  const studentId = authResult.user.id;
  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM certificates WHERE student_id = ? AND status = 'sent'`)
    .bind(studentId).first<{ total: number }>();
  const where = ["c.student_id = ?", "c.status = 'sent'"];
  const bindings: unknown[] = [studentId];
  if (cursor) {
    where.push('(COALESCE(c.sent_at, c.issued_at) < ? OR (COALESCE(c.sent_at, c.issued_at) = ? AND c.id < ?))');
    bindings.push(cursor[0], cursor[0], cursor[1]);
  }
  const { results } = await env.DB.prepare(`
    SELECT c.id, c.batch_id, cb.title, t.full_name AS teacher_name,
      c.student_score, c.quiz_title, c.image_url, c.issued_at, c.sent_at, c.status
    FROM certificates c
    JOIN certificate_batches cb ON c.batch_id = cb.id
    JOIN teachers t ON cb.teacher_id = t.username
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(c.sent_at, c.issued_at) DESC, c.id DESC
    LIMIT ?
  `).bind(...bindings, limit + 1).all<StudentCertificateItem>();

  const source = results ?? [];
  const items = source.slice(0, limit);
  const last = items.at(-1);
  const hasMore = source.length > limit;
  const page: CertificateListPage = {
    items,
    meta: {
      limit,
      total: Number(count?.total ?? 0),
      hasMore,
      nextCursor: hasMore && last ? encodeCollectionCursor('student-certificates', [last.sent_at ?? last.issued_at, last.id]) : null,
    },
  };
  return certificateSuccess(page);
}

// GET /api/certificates/notifications
