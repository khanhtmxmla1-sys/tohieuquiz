import type { Env } from '../types';
import type { JWTPayload } from '../utils/jwt';
import { parseBody } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';
import { requireTeacher } from '../middleware/jwtAuth';
import {
  addInterventionNote,
  createInterventionAssignments,
  createInterventionGroup,
  loadInterventionDashboard,
  previewInterventionAssignments,
} from '../services/interventionService';

interface InterventionRouteContext {
  request: Request;
  env: Env;
  user: JWTPayload;
  path: string;
  method: string;
}

const requestIdFrom = (request: Request): string => (
  request.headers.get('x-request-id') || crypto.randomUUID()
);

const failure = (error: unknown): Response => {
  const message = error instanceof Error ? error.message : String(error);
  const status = /not found/i.test(message) ? 404 : 400;
  return errorResponse(message || 'Intervention request failed', status);
};

export async function handleInterventionRoutes(
  context: InterventionRouteContext,
): Promise<Response | null> {
  const { request, env, user, path, method } = context;
  if (!path.startsWith('/api/results/interventions')) return null;
  if (!requireTeacher(user)) {
    return errorResponse('Forbidden: Teacher access required', 403);
  }
  const nowIso = new Date().toISOString();
  const requestId = requestIdFrom(request);

  try {
    if (path === '/api/results/interventions' && method === 'GET') {
      const url = new URL(request.url);
      const dashboard = await loadInterventionDashboard(env.DB, user, {
        className: url.searchParams.get('className') || undefined,
        quizId: url.searchParams.get('quizId') || undefined,
      });
      return jsonResponse({ status: 'success', data: dashboard });
    }

    if (path === '/api/results/interventions/groups' && method === 'POST') {
      const body = await parseBody(request);
      if (!body) return errorResponse('Invalid JSON body');
      const dashboard = await loadInterventionDashboard(env.DB, user, {
        className: body.className ? String(body.className) : undefined,
        quizId: body.quizId ? String(body.quizId) : undefined,
      });
      const suggestion = dashboard.suggestions.find((item) => item.key === String(body.suggestionKey || ''));
      if (!suggestion) return errorResponse('Intervention suggestion is no longer available', 409);
      const group = await createInterventionGroup(env.DB, user, suggestion, {
        name: body.name ? String(body.name) : undefined,
        studentIds: Array.isArray(body.studentIds) ? body.studentIds.map(String) : undefined,
      }, requestId, nowIso);
      return jsonResponse({ status: 'success', data: group }, 201);
    }

    const noteMatch = path.match(/^\/api\/results\/interventions\/groups\/([^/]+)\/notes$/);
    if (noteMatch && method === 'POST') {
      const body = await parseBody(request);
      if (!body) return errorResponse('Invalid JSON body');
      const note = await addInterventionNote(env.DB, user, noteMatch[1], {
        note: String(body.note || ''),
        studentId: body.studentId ? String(body.studentId) : undefined,
      }, requestId, nowIso);
      return jsonResponse({ status: 'success', data: note }, 201);
    }

    const assignmentPreviewMatch = path.match(/^\/api\/results\/interventions\/groups\/([^/]+)\/assignments\/preview$/);
    if (assignmentPreviewMatch && method === 'GET') {
      const url = new URL(request.url);
      const preview = await previewInterventionAssignments(
        env.DB,
        user,
        assignmentPreviewMatch[1],
        url.searchParams.get('quizId') || '',
        nowIso,
      );
      return jsonResponse({ status: 'success', data: preview });
    }

    const assignmentMatch = path.match(/^\/api\/results\/interventions\/groups\/([^/]+)\/assignments$/);
    if (assignmentMatch && method === 'POST') {
      const body = await parseBody(request);
      if (!body) return errorResponse('Invalid JSON body');
      const result = await createInterventionAssignments(env.DB, user, assignmentMatch[1], {
        quizId: String(body.quizId || ''),
        deadline: String(body.deadline || ''),
        maxAttempts: Number(body.maxAttempts),
        idempotencyKey: String(body.idempotencyKey || ''),
      }, requestId, nowIso);
      return jsonResponse({ status: 'success', data: result }, result.replayed ? 200 : 201);
    }

    return errorResponse('Intervention route not found', 404);
  } catch (error) {
    return failure(error);
  }
}
