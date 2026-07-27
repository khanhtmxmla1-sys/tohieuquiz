import type { Env } from '../types';
import {
  getRequestId,
  logStructured,
  normalizeLogRoute,
  sanitizeLogText,
  type StructuredLogSink,
} from '../utils/logger';
import { errorResponse, jsonResponse } from '../utils/response';

const MAX_REPORT_BYTES = 8_192;
const ALLOWED_EVENTS = new Set([
  'react_error_boundary',
  'stale_chunk_error',
  'unhandled_rejection',
]);

interface ClientErrorRouteOptions {
  logger?: StructuredLogSink;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const createClientErrorRoute = (options: ClientErrorRouteOptions = {}) => async (
  request: Request,
  _env: Env,
  path: string,
  method: string,
): Promise<Response | null> => {
  if (path !== '/api/client-errors') return null;
  if (method !== 'POST') return errorResponse('Method not allowed', 405);

  const requestId = getRequestId(request);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REPORT_BYTES) {
    return new Response(JSON.stringify({ status: 'error', message: 'Report is too large' }), {
      status: 413,
      headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    });
  }

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return errorResponse('Invalid report', 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_REPORT_BYTES) {
    return new Response(JSON.stringify({ status: 'error', message: 'Report is too large' }), {
      status: 413,
      headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse('Invalid report', 400);
  }
  if (!isRecord(body) || !ALLOWED_EVENTS.has(String(body.event || ''))) {
    return errorResponse('Invalid report', 400);
  }

  const message = sanitizeLogText(body.message, 1_000);
  const errorName = sanitizeLogText(body.name, 128);
  if (!message || !errorName) return errorResponse('Invalid report', 400);

  logStructured('warn', {
    event: 'client_error_reported',
    requestId,
    clientRequestId: sanitizeLogText(body.requestId, 128),
    route: normalizeLogRoute(body.route),
    errorName,
    errorMessage: message,
    release: sanitizeLogText(body.release, 128),
  }, options.logger);

  const response = jsonResponse({ status: 'accepted', requestId }, 202);
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  return new Response(response.body, { status: response.status, headers });
};

export const handleClientErrorRoute = createClientErrorRoute();
