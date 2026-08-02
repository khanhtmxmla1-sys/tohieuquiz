import type { CreateQuestionBankItemInput, PatchQuestionBankItemInput } from '../../../shared/question-bank.contract';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import {
  getQuestionBankItem,
  listQuestionBankItems,
  parseQuestionBankListParams,
  type QuestionBankActor,
  type NormalizedQuestionBankListParams,
} from '../services/questionBankRepository';
import {
  bulkImportSystemItems,
  copySystemQuestionToPersonal,
  createQuestionBankItem,
  QuestionBankServiceError,
  removeQuestionBankItem,
  updateQuestionBankItem,
} from '../services/questionBankService';
import type { Env } from '../types';
import { errorResponse, jsonResponse } from '../utils/response';

const PREFIX = '/api/test-bank';

const structuredError = (
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response => jsonResponse({
  error: {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  },
}, status);

const parseJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const actorFromAuth = (user: { username: string; role: string }): QuestionBankActor => ({
  username: user.username,
  role: user.role === 'admin' ? 'admin' : 'teacher',
});

const legacyItems = async (
  db: D1Database,
  actor: QuestionBankActor,
  teacherId: string,
) => {
  const allItems: Awaited<ReturnType<typeof listQuestionBankItems>>['items'] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params: NormalizedQuestionBankListParams = {
      scope: 'PERSONAL',
      ownerId: teacherId,
      page,
      pageSize: 100,
    };
    const result = await listQuestionBankItems(db, actor, params);
    allItems.push(...result.items);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return allItems.map((item) => ({
    id: item.id,
    teacher_id: item.ownerId,
    question_data: item.questionData,
    tags: item.metadata.tags,
    created_at: item.createdAt,
  }));
};

const isLegacyCreatePayload = (body: Record<string, unknown>): boolean =>
  !('scope' in body)
  && !('questionData' in body)
  && ('question_data' in body || 'teacher_id' in body);

export async function handleTestBankRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) return errorResponse('Forbidden', 403);

  const actor = actorFromAuth(authResult.user);
  const route = path.replace(PREFIX, '') || '/';
  let legacyMode = false;

  try {
    if (method === 'GET' && route.startsWith('/teacher/')) {
      legacyMode = true;
      const teacherId = decodeURIComponent(route.slice('/teacher/'.length)).trim();
      if (!teacherId) return errorResponse('Missing teacher id', 400);
      if (actor.role !== 'admin' && teacherId !== actor.username) return errorResponse('Forbidden', 403);
      return jsonResponse({ items: await legacyItems(env.DB, actor, teacherId) });
    }

    if (method === 'POST' && route === '/bulk') {
      const body = await parseJsonBody(request);
      if (!body || !Array.isArray(body.items)) {
        return structuredError('VALIDATION_ERROR', 'items phải là một mảng.', 422);
      }
      return jsonResponse(await bulkImportSystemItems(
        env.DB,
        actor,
        body.items as CreateQuestionBankItemInput[],
      ));
    }

    const copyMatch = route.match(/^\/([^/]+)\/copy-to-personal$/);
    if (method === 'POST' && copyMatch) {
      const item = await copySystemQuestionToPersonal(env.DB, actor, decodeURIComponent(copyMatch[1]));
      return jsonResponse({ item }, 201);
    }

    const itemMatch = route.match(/^\/([^/]+)$/);
    if (method === 'GET' && itemMatch) {
      const item = await getQuestionBankItem(env.DB, actor, decodeURIComponent(itemMatch[1]));
      if (!item) return structuredError('QUESTION_NOT_FOUND', 'Không tìm thấy câu hỏi.', 404);
      return jsonResponse({ item });
    }

    if (method === 'PATCH' && itemMatch) {
      const body = await parseJsonBody(request);
      if (!body) return structuredError('VALIDATION_ERROR', 'Payload không hợp lệ.', 422);
      const item = await updateQuestionBankItem(
        env.DB,
        actor,
        decodeURIComponent(itemMatch[1]),
        body as PatchQuestionBankItemInput,
      );
      return jsonResponse({ item });
    }

    if (method === 'DELETE' && itemMatch) {
      return jsonResponse(await removeQuestionBankItem(
        env.DB,
        actor,
        decodeURIComponent(itemMatch[1]),
      ));
    }

    if (method === 'GET' && route === '/') {
      const params = parseQuestionBankListParams(new URL(request.url), actor);
      return jsonResponse(await listQuestionBankItems(env.DB, actor, params));
    }

    if (method === 'POST' && route === '/') {
      const body = await parseJsonBody(request);
      if (!body) return structuredError('VALIDATION_ERROR', 'Payload không hợp lệ.', 422);

      if (isLegacyCreatePayload(body)) {
        legacyMode = true;
        const id = String(body.id || '').trim();
        const requestedTeacherId = String(body.teacher_id || '').trim();
        if (!id || !body.question_data) return errorResponse('Missing data', 400);
        if (actor.role !== 'admin' && requestedTeacherId && requestedTeacherId !== actor.username) {
          return errorResponse('Forbidden', 403);
        }
        const ownerId = actor.role === 'admin'
          ? requestedTeacherId || actor.username
          : actor.username;
        const item = await createQuestionBankItem(env.DB, actor, {
          id,
          scope: 'PERSONAL',
          ownerId,
          questionData: body.question_data,
          metadata: { tags: Array.isArray(body.tags) ? body.tags as string[] : [] },
        });
        return jsonResponse({ status: 'success', id: item.id });
      }

      const item = await createQuestionBankItem(
        env.DB,
        actor,
        body as unknown as CreateQuestionBankItemInput,
      );
      return jsonResponse({ item }, 201);
    }

    return legacyMode
      ? errorResponse('Test Bank Route Not Found', 404)
      : structuredError('QUESTION_NOT_FOUND', 'Test Bank Route Not Found', 404);
  } catch (error) {
    if (error instanceof QuestionBankServiceError) {
      if (legacyMode) return errorResponse(error.message, error.status);
      return structuredError(error.code, error.message, error.status, error.details);
    }
    const code = error instanceof Error ? error.message : '';
    if (code === 'VALIDATION_ERROR') return structuredError(code, 'Bộ lọc không hợp lệ.', 422);
    if (code === 'FORBIDDEN') return structuredError(code, 'Không có quyền truy cập.', 403);
    console.error('Error in test bank:', error);
    return legacyMode
      ? errorResponse('Server internal error', 500)
      : structuredError('INTERNAL_ERROR', 'Server internal error', 500);
  }
}
