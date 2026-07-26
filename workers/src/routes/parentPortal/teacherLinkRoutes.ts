import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import {
  generateAccessCode,
  generateActivationToken,
  hashActivationToken,
} from '../../parentPortal/crypto';
import { createParentLinkRepository } from '../../parentPortal/repository';
import {
  requireTeacherForParentStudent,
  type AuthorizedParentStudent,
} from '../../parentPortal/authorization';
import type {
  ParentLinkRecord,
  ParentLinkRepository,
} from '../../parentPortal/types';
import {
  parentPortalLogger,
  type ParentPortalEventLogger,
} from '../../parentPortal/observability';
import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { errorResponse, jsonResponse } from '../../utils/response';

const ACTIVATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

interface ParentAuditInput {
  action: 'PARENT_LINK_CREATED' | 'PARENT_LINK_REISSUED' | 'PARENT_LINK_REVOKED';
  linkId: string;
  studentId: string;
  actorUsername: string;
  requestId: string;
}

export interface TeacherLinkRouteRuntime {
  repository: ParentLinkRepository;
  authorize: (
    db: D1Database,
    user: JWTPayload,
    studentId: string,
  ) => Promise<AuthorizedParentStudent | Response>;
  audit: (input: ParentAuditInput) => Promise<void>;
  logger?: ParentPortalEventLogger;
  now: () => Date;
}

const safeLink = (link: ParentLinkRecord) => ({
  id: link.id,
  studentId: link.studentId,
  accessCode: link.accessCode,
  status: link.status,
  tokenVersion: link.tokenVersion,
  createdBy: link.createdBy,
  createdAt: link.createdAt,
  activatedAt: link.activatedAt,
  revokedAt: link.revokedAt,
  lastAccessedAt: link.lastAccessedAt,
});

const activationUrl = (rawToken: string) => (
  `https://phuhuynh.thtohieu.com/activate?token=${encodeURIComponent(rawToken)}`
);

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const defaultAudit = (env: Env) => async (input: ParentAuditInput): Promise<void> => {
  await env.DB.prepare(`
    INSERT INTO admin_audit_logs (
      id, actor_username, action, target_type, target_id,
      request_id, before_json, after_json, created_at
    ) VALUES (?, ?, ?, 'parent_link', ?, ?, NULL, ?, ?)
  `).bind(
    `audit-${crypto.randomUUID()}`,
    input.actorUsername,
    input.action,
    input.linkId,
    input.requestId,
    JSON.stringify({ linkId: input.linkId, studentId: input.studentId }),
    new Date().toISOString(),
  ).run();
};

const makeRuntime = (env: Env): TeacherLinkRouteRuntime => ({
  repository: createParentLinkRepository(env.DB),
  authorize: requireTeacherForParentStudent,
  audit: defaultAudit(env),
  logger: parentPortalLogger,
  now: () => new Date(),
});

const authorizeStudent = async (
  runtime: TeacherLinkRouteRuntime,
  env: Env,
  user: JWTPayload,
  studentId: string,
): Promise<AuthorizedParentStudent | Response> => runtime.authorize(env.DB, user, studentId);

export async function handleTeacherLinkRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: TeacherLinkRouteRuntime,
): Promise<Response | null> {
  const isCollection = path === '/api/parent-links';
  const reissueMatch = path.match(/^\/api\/parent-links\/([^/]+)\/reissue$/);
  const itemMatch = path.match(/^\/api\/parent-links\/([^/]+)$/);
  if (!isCollection && !reissueMatch && !itemMatch) return null;

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireTeacher(auth.user)) return errorResponse('Forbidden: Teacher access required', 403);

  const runtime = injectedRuntime || makeRuntime(env);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  if (isCollection && method === 'GET') {
    const studentId = new URL(request.url).searchParams.get('studentId')?.trim() || '';
    if (!studentId) return errorResponse('studentId is required', 400);
    const allowed = await authorizeStudent(runtime, env, auth.user, studentId);
    if (allowed instanceof Response) return allowed;
    const link = await runtime.repository.findActiveByStudentId(studentId);
    return jsonResponse({ data: { link: link ? safeLink(link) : null } });
  }

  if (isCollection && method === 'POST') {
    const body = await readJson(request);
    const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : '';
    if (!studentId) return errorResponse('studentId is required', 400);
    const allowed = await authorizeStudent(runtime, env, auth.user, studentId);
    if (allowed instanceof Response) return allowed;

    const existing = await runtime.repository.findActiveByStudentId(studentId);
    if (existing) return jsonResponse({ data: { link: safeLink(existing) } });

    const rawToken = generateActivationToken();
    const tokenHash = await hashActivationToken(rawToken);
    const now = runtime.now();
    const nowIso = now.toISOString();
    const link = await runtime.repository.createLink({
      id: `pl-${crypto.randomUUID()}`,
      studentId,
      accessCode: generateAccessCode(),
      createdBy: auth.user.username,
      createdAt: nowIso,
      activation: {
        id: `pat-${crypto.randomUUID()}`,
        tokenHash,
        expiresAt: new Date(now.getTime() + ACTIVATION_LIFETIME_MS).toISOString(),
        createdAt: nowIso,
      },
    });
    await runtime.audit({
      action: 'PARENT_LINK_CREATED',
      linkId: link.id,
      studentId,
      actorUsername: auth.user.username,
      requestId,
    });
    runtime.logger?.info('link_created', {
      linkId: link.id,
      studentId,
      actor: auth.user.username,
      requestId,
    });
    return jsonResponse({ data: { link: safeLink(link), activationUrl: activationUrl(rawToken) } }, 201);
  }

  if (reissueMatch && method === 'POST') {
    const link = await runtime.repository.findById(reissueMatch[1]);
    if (!link) return errorResponse('Parent link not found', 404);
    const allowed = await authorizeStudent(runtime, env, auth.user, link.studentId);
    if (allowed instanceof Response) return allowed;

    const rawToken = generateActivationToken();
    const now = runtime.now();
    const nowIso = now.toISOString();
    const updated = await runtime.repository.reissueLink(link.id, {
      id: `pat-${crypto.randomUUID()}`,
      tokenHash: await hashActivationToken(rawToken),
      expiresAt: new Date(now.getTime() + ACTIVATION_LIFETIME_MS).toISOString(),
      createdAt: nowIso,
    }, nowIso);
    await runtime.audit({
      action: 'PARENT_LINK_REISSUED',
      linkId: link.id,
      studentId: link.studentId,
      actorUsername: auth.user.username,
      requestId,
    });
    runtime.logger?.info('link_reissued', {
      linkId: link.id,
      studentId: link.studentId,
      actor: auth.user.username,
      requestId,
    });
    return jsonResponse({ data: { link: safeLink(updated), activationUrl: activationUrl(rawToken) } });
  }

  if (itemMatch && method === 'DELETE') {
    const link = await runtime.repository.findById(itemMatch[1]);
    if (!link) return errorResponse('Parent link not found', 404);
    const allowed = await authorizeStudent(runtime, env, auth.user, link.studentId);
    if (allowed instanceof Response) return allowed;
    const nowIso = runtime.now().toISOString();
    await runtime.repository.revokeLink(link.id, nowIso);
    await runtime.audit({
      action: 'PARENT_LINK_REVOKED',
      linkId: link.id,
      studentId: link.studentId,
      actorUsername: auth.user.username,
      requestId,
    });
    runtime.logger?.info('link_revoked', {
      linkId: link.id,
      studentId: link.studentId,
      actor: auth.user.username,
      requestId,
    });
    return jsonResponse({ data: { id: link.id, status: 'REVOKED' } });
  }

  return errorResponse('Method not allowed', 405);
}
