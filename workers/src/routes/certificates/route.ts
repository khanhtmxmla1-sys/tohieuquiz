import type { Env } from '../../types';
import { handleCreateBatch } from './createBatchHandler';
import {
  handleGetBatchDetail,
  handleGetBatches,
  handleRetryBatch,
} from './batchQueryHandlers';
import {
  handleCertificatePreview,
  handleGetCertificateImage,
  handleGetMyCertificates,
} from './certificateAccessHandlers';
import { handleRenderCertificatePreview } from './renderPreviewHandler';
import {
  handleGetTemplates,
  handleUploadTemplate,
} from './templateHandlers';
import {
  handleGetNotifications,
  handleMarkNotificationRead,
} from './notificationHandlers';
import { certificateError } from './responses';

export async function handleCertificateRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  if (path === '/api/certificates/notifications' && method === 'GET') {
    return handleGetNotifications(request, env);
  }

  const notificationReadMatch = path.match(/^\/api\/certificates\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && method === 'PATCH') {
    return handleMarkNotificationRead(request, env, notificationReadMatch[1]);
  }

  if (path === '/api/certificate-batches' && method === 'POST') {
    return handleCreateBatch(request, env);
  }
  if (path === '/api/certificate-batches' && method === 'GET') {
    return handleGetBatches(request, env);
  }

  if (path === '/api/certificates/render-preview' && method === 'POST') {
    return handleRenderCertificatePreview(request, env);
  }

  const retryMatch = path.match(/^\/api\/certificate-batches\/([^/]+)\/retry$/);
  if (retryMatch && method === 'POST') {
    return handleRetryBatch(request, env, retryMatch[1]);
  }

  const batchDetailMatch = path.match(/^\/api\/certificate-batches\/([^/]+)$/);
  if (batchDetailMatch && method === 'GET') {
    return handleGetBatchDetail(request, env, batchDetailMatch[1]);
  }

  const previewMatch = path.match(/^\/api\/certificates\/preview\/([^/]+)$/);
  if (previewMatch && method === 'GET') {
    return handleCertificatePreview(request, env, previewMatch[1]);
  }

  const imageMatch = path.match(/^\/api\/certificates\/([^/]+)\/image$/);
  if (imageMatch && method === 'GET') {
    return handleGetCertificateImage(request, env, imageMatch[1]);
  }

  if (path === '/api/certificates/templates' && method === 'GET') {
    return handleGetTemplates(request, env);
  }
  if (path === '/api/certificates/templates' && method === 'POST') {
    return handleUploadTemplate();
  }
  if ((path === '/api/certificates/my' || path === '/api/my-certificates') && method === 'GET') {
    return handleGetMyCertificates(request, env);
  }

  return certificateError('CERTIFICATE_ROUTE_NOT_FOUND', `Certificate route not found: ${path}`, 404);
}
