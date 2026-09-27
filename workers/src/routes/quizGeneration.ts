import type {
  FeatureFlagConfig,
  FeatureFlagResolution,
} from '../../../shared/feature-rollout.contract';
import type {
  ServerQuizGenerationErrorCode,
  ServerQuizGenerationResponse,
} from '../../../shared/quiz-generation.contract';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { rateLimit } from '../middleware/rateLimit';
import {
  AiCredentialServiceError,
} from '../services/aiCredentials/service';
import {
  getFeatureFlag,
  resolveFeatureFlag,
} from '../services/featureFlagService';
import {
  AiQuotaError,
} from '../services/teacherAiQuotaLedger';
import {
  generateQuizOnServer,
  ServerQuizOrchestratorError,
} from '../services/quizGeneration/orchestrator';
import { canonicalizeQuizGenerationRequest } from '../services/quizGeneration/request';
import { QuizProviderStageError } from '../services/quizGeneration/retryPolicy';
import type { Env } from '../types';
import { jsonResponse } from '../utils/response';

const PATH = '/api/ai/quiz/generate';
const FEATURE_FLAG = 'server_quiz_generation_v1';
const MAX_BODY_BYTES = 300 * 1024;

type StaffRole = 'teacher' | 'admin';

type GenerateQuizFn = (
  input: Parameters<typeof generateQuizOnServer>[0],
) => Promise<ServerQuizGenerationResponse>;

export interface QuizGenerationRouteDependencies {
  getFeatureFlag?: (db: D1Database, key: string) => Promise<FeatureFlagConfig | null>;
  resolveFeatureFlag?: (
    config: FeatureFlagConfig,
    subject: { role: 'teacher'; username: string; classIds?: string[] },
  ) => Promise<FeatureFlagResolution>;
  rateLimit?: typeof rateLimit;
  generateQuiz?: GenerateQuizFn;
}

class QuizRouteBodyError extends Error {
  constructor(public readonly tooLarge: boolean) {
    super(tooLarge ? 'QUIZ_REQUEST_TOO_LARGE' : 'QUIZ_REQUEST_INVALID');
    this.name = 'QuizRouteBodyError';
  }
}

const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const coded = (
  code: string,
  message: string,
  status: number,
): Response => noStore(jsonResponse({
  status: 'error',
  code,
  message,
}, status));

const success = (payload: ServerQuizGenerationResponse): Response => (
  noStore(jsonResponse(payload, 200))
);

const readBoundedJson = async (request: Request): Promise<unknown> => {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw new QuizRouteBodyError(true);
  }
  if (!request.body) throw new QuizRouteBodyError(false);

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
      throw new QuizRouteBodyError(true);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text);
  } catch {
    throw new QuizRouteBodyError(false);
  }
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const stableMessage = (code: ServerQuizGenerationErrorCode | string): string => {
  const messages: Record<string, string> = {
    QUIZ_REQUEST_INVALID: 'Dữ liệu tạo đề không hợp lệ.',
    QUIZ_SOURCE_UNAVAILABLE: 'Chức năng tạo đề trên máy chủ hiện chưa khả dụng cho tài khoản này.',
    QUIZ_CAPABILITY_UNSUPPORTED: 'Nguồn AI không hỗ trợ yêu cầu tạo đề này.',
    AI_DAILY_LIMIT_REACHED: 'Bạn đã đạt giới hạn tạo đề AI trong ngày.',
    AI_ACTION_CONFLICT: 'Yêu cầu tạo đề này đang chạy hoặc đã được xử lý.',
    AI_KEY_MISSING: 'Chưa có API key đã lưu cho nguồn AI cá nhân này.',
    AI_KEY_INVALID: 'API key AI cá nhân không hợp lệ.',
    AI_PROVIDER_ACCOUNT_REQUIRED: 'Tài khoản hoặc dự án AI cá nhân chưa đủ quyền sử dụng.',
    AI_PROVIDER_QUOTA: 'Nhà cung cấp AI đang giới hạn hoặc đã hết hạn mức.',
    AI_PROVIDER_UNAVAILABLE: 'Nhà cung cấp AI tạm thời không khả dụng.',
    AI_PROVIDER_TIMEOUT: 'Nhà cung cấp AI phản hồi quá thời gian.',
    AI_PROVIDER_RESPONSE_INVALID: 'Nhà cung cấp AI trả về kết quả không hợp lệ.',
    QUIZ_GENERATION_INVALID: 'Đề AI tạo ra chưa đạt kiểm tra cấu trúc bắt buộc.',
    QUIZ_GENERATION_TIMEOUT: 'Quá trình tạo đề vượt quá thời gian cho phép.',
    QUIZ_POLICY_UNAVAILABLE: 'Không thể xác minh chính sách tạo đề lúc này.',
    AI_PROVIDER_REQUEST_REJECTED: 'Nhà cung cấp AI từ chối yêu cầu tạo đề.',
    AI_CAPABILITY_UNSUPPORTED: 'Nguồn AI không hỗ trợ yêu cầu tạo đề này.',
    AI_BYOK_DISABLED: 'Nguồn AI cá nhân chưa được bật cho tài khoản này.',
    AI_VAULT_UNAVAILABLE: 'Kho khóa AI tạm thời không khả dụng.',
  };
  return messages[code] ?? 'Không thể tạo đề lúc này.';
};

const statusForCode = (code: string): number => {
  const statuses: Record<string, number> = {
    QUIZ_REQUEST_INVALID: 400,
    QUIZ_SOURCE_UNAVAILABLE: 503,
    QUIZ_CAPABILITY_UNSUPPORTED: 400,
    AI_DAILY_LIMIT_REACHED: 429,
    AI_ACTION_CONFLICT: 409,
    AI_KEY_MISSING: 404,
    AI_KEY_INVALID: 400,
    AI_PROVIDER_ACCOUNT_REQUIRED: 402,
    AI_PROVIDER_QUOTA: 429,
    AI_PROVIDER_UNAVAILABLE: 503,
    AI_PROVIDER_TIMEOUT: 504,
    AI_PROVIDER_RESPONSE_INVALID: 502,
    QUIZ_GENERATION_INVALID: 502,
    QUIZ_GENERATION_TIMEOUT: 504,
    QUIZ_POLICY_UNAVAILABLE: 503,
    AI_PROVIDER_REQUEST_REJECTED: 502,
    AI_CAPABILITY_UNSUPPORTED: 400,
    AI_BYOK_DISABLED: 403,
    AI_VAULT_UNAVAILABLE: 503,
  };
  return statuses[code] ?? 503;
};

const domainErrorResponse = (error: unknown): Response | null => {
  if (error instanceof AiQuotaError) {
    return coded(error.code, stableMessage(error.code), statusForCode(error.code));
  }
  if (error instanceof AiCredentialServiceError) {
    return coded(error.code, stableMessage(error.code), statusForCode(error.code));
  }
  if (error instanceof QuizProviderStageError) {
    return coded(error.code, stableMessage(error.code), statusForCode(error.code));
  }
  if (error instanceof ServerQuizOrchestratorError) {
    return coded(error.code, stableMessage(error.code), statusForCode(error.code));
  }
  return null;
};

export async function handleQuizGenerationRoute(
  request: Request,
  env: Env,
  path: string,
  method: string,
  dependencies: QuizGenerationRouteDependencies = {},
): Promise<Response | null> {
  if (path !== PATH) return null;
  if (method !== 'POST') {
    return coded('QUIZ_REQUEST_INVALID', 'Phương thức không hợp lệ.', 405);
  }

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return noStore(auth);
  if (!requireTeacher(auth.user)) {
    return coded('AI_ROLE_FORBIDDEN', 'Tài khoản không có quyền tạo đề AI.', 403);
  }

  const owner = auth.user.username;
  const role: StaffRole = auth.user.role === 'admin' ? 'admin' : 'teacher';
  const readFeatureFlag = dependencies.getFeatureFlag ?? getFeatureFlag;
  const resolveFlag = dependencies.resolveFeatureFlag ?? resolveFeatureFlag;
  let enabled = false;

  try {
    const config = await readFeatureFlag(env.DB, FEATURE_FLAG);
    if (config) {
      const resolution = await resolveFlag(config, {
        role: 'teacher',
        username: owner,
        classIds: [],
      });
      enabled = resolution.enabled;
    }
  } catch {
    console.error('[Server Quiz] Feature flag resolution unavailable');
    return coded(
      'QUIZ_POLICY_UNAVAILABLE',
      stableMessage('QUIZ_POLICY_UNAVAILABLE'),
      503,
    );
  }

  if (!enabled) {
    return coded(
      'QUIZ_SOURCE_UNAVAILABLE',
      stableMessage('QUIZ_SOURCE_UNAVAILABLE'),
      404,
    );
  }

  const applyRateLimit = dependencies.rateLimit ?? rateLimit;
  const ownerHash = await sha256Hex(owner);
  const limited = await applyRateLimit(request, env, {
    windowMs: 60 * 1000,
    maxRequests: 10,
    failureMode: 'closed',
    keyGenerator: () => `ratelimit:server-quiz:account:${ownerHash}`,
  });
  if (limited) return noStore(limited);

  let quizRequest;
  try {
    quizRequest = canonicalizeQuizGenerationRequest(await readBoundedJson(request));
  } catch (error) {
    if (error instanceof QuizRouteBodyError && error.tooLarge) {
      return coded('QUIZ_REQUEST_INVALID', 'Dữ liệu tạo đề vượt quá giới hạn cho phép.', 413);
    }
    return coded('QUIZ_REQUEST_INVALID', stableMessage('QUIZ_REQUEST_INVALID'), 400);
  }

  const generateQuiz = dependencies.generateQuiz ?? (
    (input: Parameters<typeof generateQuizOnServer>[0]) => generateQuizOnServer(input)
  );

  try {
    return success(await generateQuiz({
      env,
      owner: { username: owner, role },
      request: quizRequest,
      signal: request.signal,
    }));
  } catch (error) {
    const mapped = domainErrorResponse(error);
    if (mapped) return mapped;
    console.error('[Server Quiz] Generation failed');
    return coded('QUIZ_GENERATION_INVALID', stableMessage('QUIZ_GENERATION_INVALID'), 502);
  }
}
