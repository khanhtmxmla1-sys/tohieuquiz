import type { CoinAwardCreateInput } from '../../../shared/coin-awards.contract';
import { verifyJWTMiddleware, requireAdmin, requireTeacher } from '../middleware/jwtAuth';
import { getFeatureFlag, resolveFeatureFlag } from '../services/featureFlagService';
import {
  adjustCoinAwardBatch,
  createCoinAward,
  getCoinAwardSettings,
  listStaffCoinAwardHistory,
  listStudentCoinAwardHistory,
  previewCoinAward,
  reverseCoinAwardBatch,
  updateCoinAwardSettings,
  type CoinAwardActor,
  type CoinAwardAdjustmentInput,
  type CoinAwardSettingsUpdateInput,
} from '../coinAwards/service';
import type { Env } from '../types';
import { parseBody } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';

const FEATURE_KEY = 'student_coin_awards_v1';

const requestIdOf = (request: Request): string => (
  request.headers.get('x-request-id')
  || request.headers.get('cf-ray')
  || crypto.randomUUID()
);

const actorFromUser = (user: { username: string; fullName?: string; role: 'teacher' | 'admin' | 'student' }): CoinAwardActor => {
  if (user.role !== 'teacher' && user.role !== 'admin') throw new Error('Staff actor is required');
  return {
    username: user.username,
    displayName: user.fullName?.trim() || user.username,
    role: user.role,
  };
};

const errorMessages: Record<string, string> = {
  FEATURE_DISABLED: 'Tính năng thưởng xu hiện chưa khả dụng.',
  SETTINGS_NOT_FOUND: 'Chưa có cấu hình thưởng xu.',
  SETTINGS_CONFLICT: 'Cấu hình thưởng xu đã thay đổi. Vui lòng tải lại.',
  INVALID_AMOUNT: 'Số xu không hợp lệ.',
  INVALID_REASON: 'Lý do phải có từ 3 đến 200 ký tự.',
  INVALID_RECIPIENT_COUNT: 'Số lượng học sinh không hợp lệ.',
  INVALID_SELECTION: 'Lựa chọn thưởng xu không hợp lệ.',
  UNAUTHORIZED_RECIPIENT: 'Bạn không có quyền thưởng cho học sinh này.',
  INACTIVE_RECIPIENT: 'Có học sinh không còn hoạt động.',
  LIMIT_EXCEEDED: 'Đã vượt quá hạn mức thưởng xu.',
  IDEMPOTENCY_CONFLICT: 'Yêu cầu thưởng xu bị trùng khóa với nội dung khác.',
  REVERSAL_EXPIRED: 'Đã hết thời gian hoàn tác thưởng xu.',
  ALREADY_REVERSED: 'Batch thưởng xu này đã được hoàn tác.',
  INSUFFICIENT_BALANCE: 'Số dư xu hiện tại không đủ để điều chỉnh.',
};

const domainStatuses: Record<string, number> = {
  FEATURE_DISABLED: 404,
  SETTINGS_NOT_FOUND: 404,
  INVALID_AMOUNT: 400,
  INVALID_REASON: 400,
  INVALID_RECIPIENT_COUNT: 400,
  INVALID_SELECTION: 400,
  UNAUTHORIZED_RECIPIENT: 403,
  INACTIVE_RECIPIENT: 422,
  LIMIT_EXCEEDED: 422,
  IDEMPOTENCY_CONFLICT: 409,
  REVERSAL_EXPIRED: 409,
  ALREADY_REVERSED: 409,
  SETTINGS_CONFLICT: 409,
  INSUFFICIENT_BALANCE: 422,
};

const errorCodeOf = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code;
  }
  return '';
};

const domainErrorResponse = (error: unknown): Response | null => {
  const code = errorCodeOf(error);
  const status = domainStatuses[code];
  if (!status) return null;
  return jsonResponse({
    status: 'error',
    code,
    message: errorMessages[code] || 'Không thể xử lý yêu cầu thưởng xu.',
  }, status);
};

const unexpectedErrorResponse = (error: unknown, request: Request, path: string, method: string): Response => {
  const requestId = requestIdOf(request);
  // Deliberately omit the error, student IDs, and free-text reason from logs.
  console.error(JSON.stringify({ event: 'coin_award_route_failed', requestId, path, method }));
  const response = jsonResponse({
    status: 'error',
    code: 'COIN_AWARD_FAILED',
    message: 'Không thể xử lý yêu cầu thưởng xu lúc này.',
    requestId,
  }, 500);
  response.headers.set('x-request-id', requestId);
  return response;
};

const withHandledErrors = async (
  request: Request,
  path: string,
  method: string,
  operation: () => Promise<Response>,
): Promise<Response> => {
  try {
    return await operation();
  } catch (error) {
    return domainErrorResponse(error) || unexpectedErrorResponse(error, request, path, method);
  }
};

const featureDisabledResponse = (): Response => jsonResponse({
  status: 'error',
  code: 'FEATURE_DISABLED',
  message: errorMessages.FEATURE_DISABLED,
}, 404);

const requireFeature = async (env: Env, user: { role: 'student' | 'teacher' | 'admin'; username: string; classId?: string }): Promise<Response | null> => {
  try {
    const flag = await getFeatureFlag(env.DB, FEATURE_KEY);
    if (!flag || !flag.enabled) return featureDisabledResponse();
    const resolution = await resolveFeatureFlag(flag, {
      role: user.role,
      username: user.username,
      classIds: user.classId ? [user.classId] : [],
    });
    if (!resolution.enabled) return featureDisabledResponse();
    return null;
  } catch {
    // A missing or unreadable rollout config must fail closed.
    return featureDisabledResponse();
  }
};

const invalidBody = (): Response => jsonResponse({
  status: 'error', code: 'INVALID_SELECTION', message: errorMessages.INVALID_SELECTION,
}, 400);

const parseLimit = (request: Request): number | Response => {
  const raw = new URL(request.url).searchParams.get('limit');
  if (raw === null || raw === '') return 25;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ status: 'error', code: 'INVALID_SELECTION', message: 'Giới hạn danh sách phải từ 1 đến 100.' }, 400);
  }
  return limit;
};

export async function handleCoinAwardRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const isStaffPath = path === '/api/coin-awards' || path.startsWith('/api/coin-awards/');
  const isStudentPath = path === '/api/student/coin-awards' || path.startsWith('/api/student/coin-awards/');
  if (!isStaffPath && !isStudentPath) return null;

  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;

  if (isStudentPath) {
    if (method !== 'GET' || path !== '/api/student/coin-awards/history') {
      return errorResponse(`Method not allowed: ${method}`, 405);
    }
    if (user.role !== 'student') return errorResponse('Forbidden', 403);
    const studentId = String(user.id || user.username || '').trim();
    if (!studentId) return errorResponse('Unauthorized: Student identity not found', 401);
    const limit = parseLimit(request);
    if (limit instanceof Response) return limit;
    const url = new URL(request.url);
    return withHandledErrors(request, path, method, async () => jsonResponse({
      status: 'success',
      data: await listStudentCoinAwardHistory(env.DB, studentId, {
        cursor: url.searchParams.get('cursor'),
        limit,
      }),
    }));
  }

  if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher or admin access required', 403);
  const actor = actorFromUser(user);

  const previewPath = path === '/api/coin-awards/preview' && method === 'POST';
  const createPath = path === '/api/coin-awards/batches' && method === 'POST';
  const reverseMatch = path.match(/^\/api\/coin-awards\/batches\/([^/]+)\/reverse$/);
  const adjustmentMatch = path.match(/^\/api\/coin-awards\/batches\/([^/]+)\/adjustments$/);
  const reversePath = Boolean(reverseMatch) && method === 'POST';
  const adjustmentPath = Boolean(adjustmentMatch) && method === 'POST';
  const settingsReadPath = path === '/api/coin-awards/settings' && method === 'GET';
  const settingsWritePath = path === '/api/coin-awards/settings' && method === 'PUT';
  const staffHistoryPath = path === '/api/coin-awards/history' && method === 'GET';
  const knownPath = previewPath || createPath || reversePath || adjustmentPath
    || settingsReadPath || settingsWritePath || staffHistoryPath;
  if (!knownPath) return errorResponse(`Method not allowed: ${method}`, 405);

  if (settingsWritePath && !requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);
  if (reversePath && user.role !== 'teacher') return errorResponse('Forbidden: Teacher reversal required', 403);
  if (adjustmentPath && !requireAdmin(user)) return errorResponse('Forbidden: Admin adjustment required', 403);

  const isMutation = previewPath || createPath || reversePath || adjustmentPath || settingsWritePath;
  if (isMutation) {
    const unavailable = await requireFeature(env, user);
    if (unavailable) return unavailable;
  }

  const limit = staffHistoryPath ? parseLimit(request) : 25;
  if (limit instanceof Response) return limit;
  const url = new URL(request.url);

  return withHandledErrors(request, path, method, async () => {
    if (previewPath || createPath) {
      const body = await parseBody(request);
      if (!body || typeof body !== 'object') return invalidBody();
      const input = body as CoinAwardCreateInput;
      const data = previewPath
        ? await previewCoinAward(env.DB, actor, input)
        : await createCoinAward(env.DB, actor, input);
      return jsonResponse({ status: 'success', data }, createPath ? 201 : 200);
    }

    if (staffHistoryPath) {
      return jsonResponse({
        status: 'success',
        data: await listStaffCoinAwardHistory(env.DB, actor, {
          cursor: url.searchParams.get('cursor'),
          limit,
        }),
      });
    }

    if (settingsReadPath) {
      return jsonResponse({ status: 'success', data: await getCoinAwardSettings(env.DB) });
    }

    if (reversePath && reverseMatch) {
      const body = await parseBody(request);
      const reason = body && typeof body === 'object' && typeof body.reason === 'string'
        ? body.reason
        : undefined;
      return jsonResponse({
        status: 'success',
        data: await reverseCoinAwardBatch(env.DB, actor, decodeURIComponent(reverseMatch[1]), reason),
      });
    }

    if (adjustmentPath && adjustmentMatch) {
      const body = await parseBody(request);
      if (!body || typeof body !== 'object') return invalidBody();
      const input = {
        ...(body as Omit<CoinAwardAdjustmentInput, 'parentBatchId'>),
        parentBatchId: decodeURIComponent(adjustmentMatch[1]),
      } as CoinAwardAdjustmentInput;
      return jsonResponse({ status: 'success', data: await adjustCoinAwardBatch(env.DB, actor, input) });
    }

    if (settingsWritePath) {
      const body = await parseBody(request);
      if (!body || typeof body !== 'object') return invalidBody();
      return jsonResponse({
        status: 'success',
        data: await updateCoinAwardSettings(env.DB, actor, body as CoinAwardSettingsUpdateInput),
      });
    }

    return errorResponse('Not found: ' + path, 404);
  });
}
