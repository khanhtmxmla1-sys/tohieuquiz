import type {
  ParentCertificateHistoryItem,
  ParentHistoryPage,
  ParentHomeworkHistoryItem,
  ParentResultHistoryItem,
} from '../../../../shared/parent-portal.contract';
import {
  createParentHistoryService,
  type ParentHistoryFilters,
} from '../../parentPortal/historyService';
import type { ParentSessionPayload } from '../../parentPortal/types';
import type { Env } from '../../types';
import {
  authenticateParentRoute,
  parentRouteError,
  parentRouteSuccess,
} from './sessionAuth';

export interface ParentHistoryRouteRuntime {
  authenticate(request: Request, env: Env): Promise<ParentSessionPayload | Response>;
  listResults(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentResultHistoryItem>>;
  getResult(studentId: string, resultId: string): Promise<ParentResultHistoryItem | null>;
  listAssignments(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentHomeworkHistoryItem>>;
  listCertificates(
    studentId: string,
    filters: ParentHistoryFilters,
  ): Promise<ParentHistoryPage<ParentCertificateHistoryItem>>;
  getCertificateImage(studentId: string, certificateId: string): Promise<Response | null>;
}

const makeRuntime = (env: Env): ParentHistoryRouteRuntime => {
  const service = createParentHistoryService(env.DB);
  return {
    authenticate: authenticateParentRoute,
    listResults: service.listResults,
    getResult: service.getResult,
    listAssignments: service.listAssignments,
    listCertificates: service.listCertificates,
    getCertificateImage: async (studentId, certificateId) => {
      const certificate = await env.DB.prepare(`
        SELECT png_r2_key
        FROM certificates
        WHERE id = ? AND student_id = ? AND status = 'sent'
        LIMIT 1
      `).bind(certificateId, studentId).first<{ png_r2_key: string | null }>();
      if (!certificate?.png_r2_key) return null;

      const image = await env.CERT_IMAGES.get(certificate.png_r2_key);
      if (!image) return null;

      const headers = new Headers({
        'Content-Type': image.httpMetadata?.contentType ?? 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (image.httpEtag) headers.set('ETag', image.httpEtag);

      return new Response(image.body, { headers });
    },
  };
};

const validDate = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

const parseFilters = (url: URL): ParentHistoryFilters | Response => {
  const rawPage = Number(url.searchParams.get('page') || 1);
  const rawLimit = Number(url.searchParams.get('limit') || 20);
  if (!Number.isInteger(rawPage) || rawPage < 1) {
    return parentRouteError('PARENT_HISTORY_PAGE_INVALID', 'Trang không hợp lệ.', 400);
  }
  const page = rawPage;
  const limit = Number.isInteger(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
  const rawFrom = url.searchParams.get('from');
  const rawTo = url.searchParams.get('to');
  const from = validDate(rawFrom);
  const to = validDate(rawTo);
  if ((rawFrom && !from) || (rawTo && !to) || (from && to && from >= to)) {
    return parentRouteError('PARENT_HISTORY_RANGE_INVALID', 'Khoảng thời gian không hợp lệ.', 400);
  }
  return {
    page,
    limit,
    subject: url.searchParams.get('subject')?.trim() || null,
    from,
    to,
  };
};

export async function handleParentHistoryRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: ParentHistoryRouteRuntime,
): Promise<Response | null> {
  const resultDetail = path.match(/^\/api\/parent\/results\/([^/]+)$/);
  const certificateImage = path.match(/^\/api\/parent\/certificates\/([^/]+)\/image$/);
  const knownPath = path === '/api/parent/results'
    || Boolean(resultDetail)
    || path === '/api/parent/assignments'
    || path === '/api/parent/certificates'
    || Boolean(certificateImage);
  if (!knownPath) return null;
  if (method !== 'GET') {
    return parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405);
  }

  const runtime = injectedRuntime || makeRuntime(env);
  const session = await runtime.authenticate(request, env);
  if (session instanceof Response) return session;

  if (certificateImage) {
    const image = await runtime.getCertificateImage(
      session.studentId,
      decodeURIComponent(certificateImage[1]),
    );
    return image || parentRouteError(
      'PARENT_CERTIFICATE_IMAGE_NOT_FOUND',
      'Không tìm thấy ảnh chứng nhận.',
      404,
    );
  }

  if (resultDetail) {
    const item = await runtime.getResult(session.studentId, decodeURIComponent(resultDetail[1]));
    if (!item) return parentRouteError('PARENT_RESULT_NOT_FOUND', 'Không tìm thấy kết quả.', 404);
    return parentRouteSuccess(item);
  }

  const filters = parseFilters(new URL(request.url));
  if (filters instanceof Response) return filters;
  if (path === '/api/parent/results') {
    return parentRouteSuccess(await runtime.listResults(session.studentId, filters));
  }
  if (path === '/api/parent/assignments') {
    return parentRouteSuccess(await runtime.listAssignments(session.studentId, filters));
  }
  return parentRouteSuccess(await runtime.listCertificates(session.studentId, filters));
}
