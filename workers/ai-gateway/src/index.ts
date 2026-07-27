export interface AiOriginBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface Env {
  AI_ORIGIN: AiOriginBinding;
  AI_GATEWAY_TOKEN: string;
  UPSTREAM_API_TOKEN: string;
  UPSTREAM_BASE_URL: string;
  ALLOWED_ORIGINS?: string;
  MAX_REQUEST_BODY_BYTES?: string;
}

const V1_PATH = /^\/v1(?:\/.*)?$/;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);
const DEFAULT_MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;
const MAX_UPSTREAM_ATTEMPTS = 2;
const RETRY_DELAY_MS = 250;
const RETRYABLE_UPSTREAM_STATUSES = new Set([
  502, 503, 504, 522, 523, 524, 525, 526, 530,
]);

const sleep = (milliseconds: number): Promise<void> => new Promise(
  (resolve) => setTimeout(resolve, milliseconds),
);

const jsonError = (
  status: number,
  message: string,
  code: string,
  extraHeaders: HeadersInit = {},
): Response => new Response(JSON.stringify({
  error: {
    message,
    type: status >= 500 ? 'server_error' : 'invalid_request_error',
    code,
  },
}), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  },
});

const normalizeBaseUrl = (value: string): URL => {
  const base = new URL(value);
  if (base.protocol !== 'http:') {
    throw new Error('UPSTREAM_BASE_URL must use HTTP through the VPC binding');
  }
  base.pathname = '/';
  base.search = '';
  base.hash = '';
  return base;
};

const parseAllowedOrigins = (value?: string): Set<string> => new Set(
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const addCorsHeaders = (headers: Headers, request: Request, env: Env): void => {
  const origin = request.headers.get('Origin');
  if (!origin) return;

  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (!allowedOrigins.has(origin)) return;

  headers.set('Access-Control-Allow-Origin', origin);
  headers.append('Vary', 'Origin');
};

const withCors = (response: Response, request: Request, env: Env): Response => {
  const headers = new Headers(response.headers);
  addCorsHeaders(headers, request, env);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const hash = async (value: string): Promise<Uint8Array> => {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
};

const safeEqual = async (provided: string, expected: string): Promise<boolean> => {
  if (!provided || !expected) return false;
  const [providedHash, expectedHash] = await Promise.all([hash(provided), hash(expected)]);
  let difference = provided.length ^ expected.length;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index];
  }
  return difference === 0;
};

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return null;
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
};

const getMaxRequestBodyBytes = (env: Env): number => {
  const configured = Number(env.MAX_REQUEST_BODY_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_REQUEST_BODY_BYTES;
};

const validateBodySize = (request: Request, env: Env): Response | null => {
  const contentLength = request.headers.get('Content-Length');
  if (!contentLength) return null;

  const parsed = Number(contentLength);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return jsonError(400, 'Invalid Content-Length header.', 'invalid_content_length');
  }
  if (parsed > getMaxRequestBodyBytes(env)) {
    return jsonError(413, 'Request body is too large.', 'request_body_too_large');
  }
  return null;
};

const buildUpstreamHeaders = (request: Request, env: Env): Headers => {
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${env.UPSTREAM_API_TOKEN}`);
  headers.delete('Host');
  headers.delete('Content-Length');
  headers.delete('CF-Connecting-IP');
  headers.delete('CF-Ray');
  headers.delete('CF-Visitor');
  headers.delete('X-Forwarded-For');
  headers.delete('X-Forwarded-Proto');
  return headers;
};

export type UpstreamFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const handleAiGatewayRequest = async (
  request: Request,
  env: Env,
  upstreamFetch: UpstreamFetch,
): Promise<Response> => {
  const requestUrl = new URL(request.url);

  if (!V1_PATH.test(requestUrl.pathname)) {
    return withCors(jsonError(404, 'Not Found', 'not_found'), request, env);
  }

  if (!ALLOWED_METHODS.has(request.method)) {
    return withCors(jsonError(405, 'Method Not Allowed', 'method_not_allowed', {
      Allow: 'GET, HEAD, POST, OPTIONS',
    }), request, env);
  }

  const origin = request.headers.get('Origin');
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (origin && !allowedOrigins.has(origin)) {
    return jsonError(403, 'Origin is not allowed.', 'origin_not_allowed');
  }

  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'public, max-age=86400',
    });
    addCorsHeaders(headers, request, env);
    return new Response(null, { status: 204, headers });
  }

  const providedToken = extractBearerToken(request);
  if (!providedToken || !(await safeEqual(providedToken, env.AI_GATEWAY_TOKEN))) {
    return withCors(jsonError(401, 'Invalid or missing API token.', 'invalid_api_key', {
      'WWW-Authenticate': 'Bearer',
    }), request, env);
  }

  const bodyError = validateBodySize(request, env);
  if (bodyError) return withCors(bodyError, request, env);

  let upstreamBaseUrl: URL;
  try {
    upstreamBaseUrl = normalizeBaseUrl(env.UPSTREAM_BASE_URL);
  } catch {
    return withCors(jsonError(500, 'AI gateway is not configured.', 'gateway_misconfigured'), request, env);
  }

  const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, upstreamBaseUrl);
  let requestBody: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      requestBody = await request.arrayBuffer();
    } catch {
      return withCors(jsonError(400, 'Request body could not be read.', 'invalid_request_body'), request, env);
    }
    if (requestBody.byteLength > getMaxRequestBodyBytes(env)) {
      return withCors(jsonError(413, 'Request body is too large.', 'request_body_too_large'), request, env);
    }
  }

  const createUpstreamInit = (): RequestInit => ({
    method: request.method,
    headers: buildUpstreamHeaders(request, env),
    redirect: 'manual',
    ...(requestBody ? { body: requestBody.slice(0) } : {}),
  });

  let upstreamResponse: Response | null = null;
  let attempts = 0;
  for (attempts = 1; attempts <= MAX_UPSTREAM_ATTEMPTS; attempts += 1) {
    try {
      upstreamResponse = await upstreamFetch(upstreamUrl, createUpstreamInit());
    } catch {
      if (attempts < MAX_UPSTREAM_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return withCors(jsonError(502, 'AI upstream is unavailable.', 'upstream_unavailable'), request, env);
    }

    if (
      RETRYABLE_UPSTREAM_STATUSES.has(upstreamResponse.status)
      && attempts < MAX_UPSTREAM_ATTEMPTS
    ) {
      await upstreamResponse.body?.cancel().catch(() => undefined);
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    break;
  }

  if (!upstreamResponse) {
    return withCors(jsonError(502, 'AI upstream is unavailable.', 'upstream_unavailable'), request, env);
  }

  const headers = new Headers(upstreamResponse.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-AI-Gateway-Attempts', String(attempts));
  headers.delete('Set-Cookie');
  addCorsHeaders(headers, request, env);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const vpcFetch: UpstreamFetch = (input, init) => env.AI_ORIGIN.fetch(input, init);
    return handleAiGatewayRequest(request, env, vpcFetch);
  },
} satisfies ExportedHandler<Env>;
