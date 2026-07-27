export type ClientErrorEventName =
  | 'react_error_boundary'
  | 'stale_chunk_error'
  | 'unhandled_rejection';

export interface ClientErrorReport {
  event: ClientErrorEventName;
  name: string;
  message: string;
  route: string;
  release: string;
  requestId: string;
  componentStack?: string;
  time: string;
}

export type ClientErrorTransport = (
  endpoint: string,
  report: ClientErrorReport,
) => void | Promise<void>;

interface BuildClientErrorOptions {
  event: ClientErrorEventName;
  componentStack?: string;
  route?: string;
  release?: string;
  requestId?: string;
  now?: () => Date;
}

interface ReportClientErrorOptions extends BuildClientErrorOptions {
  endpoint?: string;
  transport?: ClientErrorTransport;
}

const MESSAGE_LIMIT = 1_000;
const COMPONENT_STACK_LIMIT = 2_000;
const NAME_LIMIT = 100;
const RELEASE_LIMIT = 100;
const DEFAULT_ENDPOINT = '/api/client-errors';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const SENSITIVE_QUERY_PATTERN = /([?&](?:access_token|api_key|key|password|secret|token)=)[^&#\s]+/gi;

const truncate = (value: string, limit: number): string => (
  value.length <= limit ? value : value.slice(0, limit)
);

const sanitizeText = (value: unknown, limit: number): string => {
  const rendered = String(value ?? '')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(SENSITIVE_QUERY_PATTERN, '$1[REDACTED]');
  return truncate(rendered, limit);
};

const errorName = (error: unknown): string => {
  if (error instanceof Error) return sanitizeText(error.name || 'Error', NAME_LIMIT);
  return 'Error';
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return sanitizeText(error.message, MESSAGE_LIMIT);
  if (typeof error === 'string') return sanitizeText(error, MESSAGE_LIMIT);
  if (error && typeof error === 'object' && 'message' in error) {
    return sanitizeText((error as { message?: unknown }).message, MESSAGE_LIMIT);
  }
  return sanitizeText('Unknown client error', MESSAGE_LIMIT);
};

const currentRoute = (): string => {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
};

const normalizeRoute = (route: string | undefined): string => {
  const candidate = route || currentRoute();
  try {
    return new URL(candidate, 'https://tohieuquiz.invalid').pathname || '/';
  } catch {
    return '/';
  }
};

const createRequestId = (): string => {
  try {
    return globalThis.crypto?.randomUUID?.() || `client-${Date.now()}`;
  } catch {
    return `client-${Date.now()}`;
  }
};

const configuredRelease = (): string => (
  String(import.meta.env.VITE_APP_RELEASE || 'unknown')
);

const configuredEndpoint = (): string => (
  String(import.meta.env.VITE_CLIENT_ERROR_REPORT_URL || DEFAULT_ENDPOINT).trim()
  || DEFAULT_ENDPOINT
);

const defaultTransport: ClientErrorTransport = async (endpoint, report) => {
  if (typeof fetch !== 'function') return;
  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': report.requestId,
    },
    body: JSON.stringify(report),
    credentials: 'same-origin',
    keepalive: true,
  });
};

export const buildClientErrorReport = (
  error: unknown,
  options: BuildClientErrorOptions,
): ClientErrorReport => {
  const componentStack = options.componentStack
    ? sanitizeText(options.componentStack, COMPONENT_STACK_LIMIT)
    : undefined;

  return {
    event: options.event,
    name: errorName(error),
    message: errorMessage(error),
    route: normalizeRoute(options.route),
    release: sanitizeText(options.release ?? configuredRelease(), RELEASE_LIMIT),
    requestId: sanitizeText(options.requestId ?? createRequestId(), NAME_LIMIT),
    ...(componentStack ? { componentStack } : {}),
    time: (options.now?.() ?? new Date()).toISOString(),
  };
};

export const reportClientError = (
  error: unknown,
  options: ReportClientErrorOptions,
): void => {
  try {
    const report = buildClientErrorReport(error, options);
    const transport = options.transport ?? defaultTransport;
    const endpoint = options.endpoint ?? configuredEndpoint();
    void Promise.resolve(transport(endpoint, report)).catch(() => undefined);
  } catch {
    // Telemetry must never become a second application failure.
  }
};
