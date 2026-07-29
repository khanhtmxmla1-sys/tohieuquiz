import type { Env } from '../types';
import {
  getRequestId,
  logStructured,
  normalizeLogRoute,
  sanitizeLogText,
  type StructuredLogSink,
} from '../utils/logger';
import { errorResponse, jsonResponse } from '../utils/response';

const MAX_REPORT_BYTES = 4_096;
const ALLOWED_METRICS = new Set(['CLS', 'INP', 'LCP']);
const ALLOWED_RATINGS = new Set(['good', 'needs-improvement', 'poor']);

interface ClientTelemetryRouteOptions {
  logger?: StructuredLogSink;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseFiniteMetricValue = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > 120_000) return null;
  return value;
};

export const createClientTelemetryRoute = (
  options: ClientTelemetryRouteOptions = {},
) => async (
  request: Request,
  _env: Env,
  path: string,
  method: string,
): Promise<Response | null> => {
  if (path !== '/api/client-telemetry') return null;
  if (method !== 'POST') return errorResponse('Method not allowed', 405);

  const requestId = getRequestId(request);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REPORT_BYTES) return errorResponse('Report is too large', 413);

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return errorResponse('Invalid report', 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_REPORT_BYTES) {
    return errorResponse('Report is too large', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse('Invalid report', 400);
  }
  if (!isRecord(body) || body.kind !== 'web_vital') return errorResponse('Invalid report', 400);

  const metricName = String(body.name || '').toUpperCase();
  const metricRating = String(body.rating || '');
  const metricValue = parseFiniteMetricValue(body.value);
  if (!ALLOWED_METRICS.has(metricName)
    || !ALLOWED_RATINGS.has(metricRating)
    || metricValue === null) {
    return errorResponse('Invalid report', 400);
  }

  logStructured('info', {
    event: 'client_web_vital',
    requestId,
    clientRequestId: sanitizeLogText(body.requestId, 128),
    route: normalizeLogRoute(body.route),
    release: sanitizeLogText(body.release, 128),
    metricName,
    metricValue,
    metricRating,
  }, options.logger);

  const response = jsonResponse({ status: 'accepted', requestId }, 202);
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  return new Response(response.body, { status: response.status, headers });
};

export const handleClientTelemetryRoute = createClientTelemetryRoute();
