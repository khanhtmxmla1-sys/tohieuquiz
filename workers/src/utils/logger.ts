export type LogLevel = 'info' | 'warn' | 'error';
export type StructuredLogSink = Pick<Console, LogLevel>;

export interface StructuredLogFields {
  event: string;
  requestId: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  errorCode?: string;
  context?: string;
  clientRequestId?: string;
  errorName?: string;
  errorMessage?: string;
  release?: string;
  routeTemplate?: string;
  roleCategory?: string;
  metricName?: string;
  metricValue?: number;
  metricRating?: string;
}

const TEXT_LIMIT = 1_000;
const SHORT_TEXT_LIMIT = 128;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const SENSITIVE_QUERY_PATTERN = /([?&](?:access_token|api_key|key|password|secret|token)=)[^&#\s]+/gi;

export const sanitizeLogText = (value: unknown, limit = TEXT_LIMIT): string => (
  String(value ?? '')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(SENSITIVE_QUERY_PATTERN, '$1[REDACTED]')
    .slice(0, limit)
);

export const normalizeLogRoute = (value: unknown): string => {
  try {
    return new URL(String(value || '/'), 'https://route.local').pathname || '/';
  } catch {
    return '/';
  }
};

const DYNAMIC_PARENT_SEGMENTS = new Set([
  'assignments', 'batches', 'catalog', 'certificate-batches', 'certificates',
  'classes', 'groups', 'notifications', 'orders', 'pets', 'phieu', 'questions',
  'quiz-drafts', 'quizzes', 'result-reports', 'results', 'students', 'submissions',
  'teachers',
]);

const STATIC_ACTION_SEGMENTS = new Set([
  'approve', 'archive', 'cancel', 'click', 'confirm', 'deliver', 'events', 'image',
  'metrics', 'mine', 'preferences', 'read', 'retry', 'settings', 'verify',
]);

export const normalizeLogRouteTemplate = (value: unknown): string => {
  const route = normalizeLogRoute(value);
  const segments = route.split('/').filter(Boolean);
  const normalized = segments.map((segment, index) => {
    const previous = segments[index - 1]?.toLowerCase() || '';
    const lower = segment.toLowerCase();
    const looksDynamic = /^\d+$/.test(segment)
      || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)
      || (/^[a-z0-9_-]{8,}$/i.test(segment) && /\d/.test(segment));
    if (looksDynamic || (DYNAMIC_PARENT_SEGMENTS.has(previous) && !STATIC_ACTION_SEGMENTS.has(lower))) {
      return ':id';
    }
    return segment;
  });
  return normalized.length > 0 ? `/${normalized.join('/')}` : '/';
};

export function getRequestId(request: Request): string {
  const supplied = request.headers.get('x-request-id') || request.headers.get('cf-ray') || '';
  const normalized = sanitizeLogText(supplied.trim(), SHORT_TEXT_LIMIT);
  return normalized || crypto.randomUUID();
}

export function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', sanitizeLogText(requestId, SHORT_TEXT_LIMIT));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function logStructured(
  level: LogLevel,
  fields: StructuredLogFields,
  logger: StructuredLogSink = console,
): void {
  const event: Record<string, string | number> = {
    event: sanitizeLogText(fields.event, SHORT_TEXT_LIMIT),
    requestId: sanitizeLogText(fields.requestId, SHORT_TEXT_LIMIT),
  };
  if (fields.route !== undefined) event.route = normalizeLogRoute(fields.route);
  if (fields.method !== undefined) event.method = sanitizeLogText(fields.method, 16).toUpperCase();
  if (fields.status !== undefined) event.status = Math.trunc(fields.status);
  if (fields.durationMs !== undefined) event.durationMs = Math.max(0, Math.round(fields.durationMs));
  if (fields.errorCode !== undefined) event.errorCode = sanitizeLogText(fields.errorCode, SHORT_TEXT_LIMIT);
  if (fields.context !== undefined) event.context = sanitizeLogText(fields.context, SHORT_TEXT_LIMIT);
  if (fields.clientRequestId !== undefined) event.clientRequestId = sanitizeLogText(fields.clientRequestId, SHORT_TEXT_LIMIT);
  if (fields.errorName !== undefined) event.errorName = sanitizeLogText(fields.errorName, SHORT_TEXT_LIMIT);
  if (fields.errorMessage !== undefined) event.errorMessage = sanitizeLogText(fields.errorMessage, TEXT_LIMIT);
  if (fields.release !== undefined) event.release = sanitizeLogText(fields.release, SHORT_TEXT_LIMIT);
  if (fields.routeTemplate !== undefined) event.routeTemplate = normalizeLogRouteTemplate(fields.routeTemplate);
  if (fields.roleCategory !== undefined) event.roleCategory = sanitizeLogText(fields.roleCategory, 32);
  if (fields.metricName !== undefined) event.metricName = sanitizeLogText(fields.metricName, 16);
  if (fields.metricValue !== undefined && Number.isFinite(fields.metricValue)) event.metricValue = Number(fields.metricValue);
  if (fields.metricRating !== undefined) event.metricRating = sanitizeLogText(fields.metricRating, 32);
  logger[level](JSON.stringify(event));
}
