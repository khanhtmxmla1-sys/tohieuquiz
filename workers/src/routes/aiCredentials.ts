import { z } from 'zod';
import type { PersonalAiProvider } from '../../../shared/teacher-ai-credentials.contract';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { rateLimit } from '../middleware/rateLimit';
import {
  AiCredentialServiceError,
  deleteAiCredential,
  getAiCredentialState,
  isTeacherAiByokEnabled,
  saveAiCredential,
  testStoredAiCredential,
} from '../services/aiCredentials/service';
import { AiCredentialProviderError } from '../services/aiCredentials/providerClient';
import type { Env } from '../types';
import { jsonResponse } from '../utils/response';

const BASE_PATH = '/api/account/ai-credentials';
const MAX_BODY_BYTES = 8 * 1024;
const PROVIDERS = new Set<PersonalAiProvider>(['gemini', 'deepseek']);

const saveSchema = z.object({
  apiKey: z.string()
    .min(16)
    .max(4096)
    .refine((value) => !/[\s\u0000-\u001F\u007F]/u.test(value), 'invalid key'),
  expectedVersion: z.number().int().min(0),
}).strict();

const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const coded = (code: string, message: string, status: number): Response => noStore(jsonResponse({
  status: 'error',
  code,
  message,
}, status));

const success = (data: unknown): Response => noStore(jsonResponse(data, 200));

class BodyReadError extends Error {
  constructor(public readonly code: 'AI_REQUEST_TOO_LARGE' | 'AI_REQUEST_INVALID') {
    super(code);
  }
}

const readBoundedText = async (request: Request): Promise<string> => {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw new BodyReadError('AI_REQUEST_TOO_LARGE');
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      try { await reader.cancel(); } catch { /* no-op */ }
      throw new BodyReadError('AI_REQUEST_TOO_LARGE');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
};

const readSaveBody = async (request: Request): Promise<z.infer<typeof saveSchema>> => {
  const text = await readBoundedText(request);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BodyReadError('AI_REQUEST_INVALID');
  }
  const result = saveSchema.safeParse(parsed);
  if (!result.success) throw new BodyReadError('AI_REQUEST_INVALID');
  return result.data;
};

const parseProvider = (path: string): { provider: PersonalAiProvider; isTest: boolean } | null => {
  const match = path.match(/^\/api\/account\/ai-credentials\/([^/]+)(\/test)?$/);
  if (!match) return null;
  const provider = match[1] as PersonalAiProvider;
  if (!PROVIDERS.has(provider)) return null;
  return { provider, isTest: Boolean(match[2]) };
};

const parseExpectedVersion = (request: Request): number | null => {
  const raw = request.headers.get('if-match')?.trim() || '';
  const match = raw.match(/^(?:W\/)?"?(\d+)"?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const applyCredentialRateLimits = async (
  request: Request,
  env: Env,
  owner: string,
): Promise<Response | null> => {
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
  const [ownerHash, ipHash] = await Promise.all([
    sha256Hex(owner),
    sha256Hex(ip),
  ]);

  const accountLimit = await rateLimit(request, env, {
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
    failureMode: 'closed',
    keyGenerator: () => `ratelimit:ai-credential:account:${ownerHash}`,
  });
  if (accountLimit) return noStore(accountLimit);

  const ipLimit = await rateLimit(request, env, {
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    failureMode: 'closed',
    keyGenerator: () => `ratelimit:ai-credential:ip:${ipHash}`,
  });
  return ipLimit ? noStore(ipLimit) : null;
};

const serviceError = (error: unknown): Response | null => {
  if (error instanceof AiCredentialProviderError) {
    const status = error.code === 'AI_KEY_INVALID'
      ? 400
      : error.code === 'AI_PROVIDER_ACCOUNT_REQUIRED'
        ? 402
      : error.code === 'AI_PROVIDER_QUOTA'
        ? 429
        : error.code === 'AI_PROVIDER_REQUEST_REJECTED'
          ? 502
        : error.code === 'AI_PROVIDER_TIMEOUT'
          ? 504
          : 503;
    return coded(error.code, error.message, status);
  }
  if (error instanceof AiCredentialServiceError) {
    const status = error.code === 'AI_KEY_VERSION_CONFLICT'
      ? 409
      : error.code === 'AI_KEY_MISSING'
        ? 404
        : error.code === 'AI_BYOK_DISABLED'
          ? 403
          : 503;
    const message: Record<AiCredentialServiceError['code'], string> = {
      AI_KEY_MISSING: 'Chưa có API key đã lưu cho nhà cung cấp này.',
      AI_KEY_VERSION_CONFLICT: 'API key đã thay đổi ở một phiên khác. Hãy tải lại trước khi thao tác.',
      AI_BYOK_DISABLED: 'Nguồn AI cá nhân hiện chưa được bật cho tài khoản này.',
      AI_VAULT_UNAVAILABLE: 'Kho khóa AI tạm thời không khả dụng.',
    };
    return coded(error.code, message[error.code], status);
  }
  return null;
};

export async function handleAiCredentialRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (path !== BASE_PATH && !path.startsWith(`${BASE_PATH}/`)) return null;

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return noStore(auth);
  if (!requireTeacher(auth.user)) {
    return coded('AI_ROLE_FORBIDDEN', 'Tài khoản không có quyền quản lý API key AI.', 403);
  }
  const role = auth.user.role === 'admin' ? 'admin' : 'teacher';
  const owner = auth.user.username;
  const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();

  try {
    if (path === BASE_PATH) {
      if (method !== 'GET') {
        return coded('AI_REQUEST_INVALID', 'Phương thức không hợp lệ.', 405);
      }
      return success(await getAiCredentialState(env, owner, role));
    }

    const parsed = parseProvider(path);
    if (!parsed) {
      return coded('AI_REQUEST_INVALID', 'Nhà cung cấp AI không hợp lệ.', 400);
    }

    if (method === 'DELETE' && !parsed.isTest) {
      const expectedVersion = parseExpectedVersion(request);
      if (expectedVersion === null) {
        return coded('AI_REQUEST_INVALID', 'Thiếu phiên bản API key cần xóa.', 400);
      }
      await deleteAiCredential(env, {
        owner,
        role,
        provider: parsed.provider,
        expectedVersion,
        requestId,
      });
      return success({
        provider: parsed.provider,
        configured: false,
        last4: null,
        version: 0,
        verifiedAt: null,
        updatedAt: null,
      });
    }

    if (!(await isTeacherAiByokEnabled(env, owner, role))) {
      throw new AiCredentialServiceError('AI_BYOK_DISABLED');
    }

    if (method === 'PUT' && !parsed.isTest) {
      const limited = await applyCredentialRateLimits(request, env, owner);
      if (limited) return limited;
      const body = await readSaveBody(request);
      const credential = await saveAiCredential(env, {
        owner,
        role,
        provider: parsed.provider,
        apiKey: body.apiKey,
        expectedVersion: body.expectedVersion,
        requestId,
        signal: request.signal,
      });
      return success({ credential });
    }

    if (method === 'POST' && parsed.isTest) {
      const limited = await applyCredentialRateLimits(request, env, owner);
      if (limited) return limited;
      const bodyText = await readBoundedText(request);
      if (bodyText.length > 0) {
        return coded('AI_REQUEST_INVALID', 'Kiểm tra key đã lưu không nhận nội dung request.', 400);
      }
      const credential = await testStoredAiCredential(env, {
        owner,
        role,
        provider: parsed.provider,
        requestId,
        signal: request.signal,
      });
      return success({ credential });
    }

    return coded('AI_REQUEST_INVALID', 'Phương thức không hợp lệ.', 405);
  } catch (error) {
    if (error instanceof BodyReadError) {
      return error.code === 'AI_REQUEST_TOO_LARGE'
        ? coded(error.code, 'Dữ liệu API key vượt quá giới hạn cho phép.', 413)
        : coded(error.code, 'Dữ liệu API key không hợp lệ.', 400);
    }
    const mapped = serviceError(error);
    if (mapped) return mapped;
    console.error('[AI Credentials] Request failed');
    return coded('AI_VAULT_UNAVAILABLE', 'Kho khóa AI tạm thời không khả dụng.', 503);
  }
}
