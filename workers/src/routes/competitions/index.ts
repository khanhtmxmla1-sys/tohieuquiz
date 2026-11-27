import type { Env } from '../../types';
import { requireAdmin, requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import { createCompetitionEventLogger } from '../../competition/observability';
import { getFeatureFlag, resolveFeatureFlag } from '../../services/featureFlagService';
import { errorResponse } from '../../utils/response';
import type { JWTPayload } from '../../utils/jwt';
import { handleCompetitionPortalRoutes } from './portalRoutes';
import { routeError, routeParts } from './routeSupport';
import { handleSchoolExamRoutes } from './schoolExamRoutes';
import { handleStaffCompetitionRoutes } from './staffCompetitionRoutes';
import { handleStudentCompetitionPortalRoutes } from './studentPortalRoutes';
import { handleStudentRoundRoutes } from './studentRoundRoutes';

async function teacherClassIds(db: D1Database, user: JWTPayload): Promise<string[] | undefined> {
  if (requireAdmin(user)) return undefined;
  const result = await db.prepare(`
    SELECT id
    FROM classes
    WHERE teacher_username = ? AND COALESCE(archived_at, '') = ''
    ORDER BY id ASC
  `).bind(user.username).all<{ id: string }>();
  return (result.results || []).map((row) => row.id);
}

async function authenticatedStudentId(db: D1Database, user: JWTPayload): Promise<string | null> {
  if (user.role !== 'student') return null;
  const id = String(user.id || '').trim();
  const username = String(user.username || '').trim();
  if (!username) return null;
  if (id) {
    const row = await db.prepare(`
      SELECT id FROM students WHERE id = ? AND username = ? LIMIT 1
    `).bind(id, username).first<{ id: string }>();
    return row?.id || null;
  }
  const row = await db.prepare('SELECT id FROM students WHERE username = ? LIMIT 1')
    .bind(username)
    .first<{ id: string }>();
  return row?.id || null;
}

async function hasCompetitionRolloutAccess(db: D1Database, user: JWTPayload): Promise<boolean> {
  try {
    const flag = await getFeatureFlag(db, 'competition_v1');
    if (!flag) return false;
    const classIds = user.role === 'student'
      ? (user.classId ? [user.classId] : [])
      : user.role === 'teacher'
        ? await teacherClassIds(db, user)
        : [];
    const resolution = await resolveFeatureFlag(flag, {
      role: user.role,
      username: user.username,
      classIds,
    });
    return resolution.enabled;
  } catch {
    return false;
  }
}

async function handleCompetitionRoutesCore(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const isStaffNamespace = path === '/api/competitions' || path.startsWith('/api/competitions/');
  const isSchoolExamNamespace = path.startsWith('/api/school-exams/');
  const isStudentNamespace = path === '/api/student/competitions'
    || path.startsWith('/api/student/competitions/');
  if (!isStaffNamespace && !isSchoolExamNamespace && !isStudentNamespace) return null;

  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;
  if (!await hasCompetitionRolloutAccess(env.DB, user)) {
    return errorResponse('COMPETITION_NOT_AVAILABLE', 404);
  }

  if (isStudentNamespace) {
    if (user.role !== 'student') return errorResponse('Forbidden', 403);
    try {
      const studentId = await authenticatedStudentId(env.DB, user);
      if (!studentId) return errorResponse('Unauthorized: Student identity not found', 401);

      const studentPortalResponse = await handleStudentCompetitionPortalRoutes(
        env.DB,
        path,
        method,
        studentId,
        user.username,
      );
      if (studentPortalResponse) return studentPortalResponse;
      return await handleStudentRoundRoutes(request, env, path, method, studentId);
    } catch (error) {
      return routeError(error);
    }
  }

  if (!requireTeacher(user)) return errorResponse('Forbidden', 403);
  const schoolExamIncidentParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/incidents$/);
  const schoolExamExportCollectionParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/exports$/);
  const isTeacherIncidentMutation = Boolean(schoolExamIncidentParts) && method === 'POST';
  const isTeacherExportMutation = Boolean(schoolExamExportCollectionParts) && method === 'POST';
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isMutation && !requireAdmin(user) && !isTeacherIncidentMutation && !isTeacherExportMutation) {
    return errorResponse('Forbidden', 403);
  }

  try {
    const portalResponse = await handleCompetitionPortalRoutes(
      request,
      env.DB,
      path,
      method,
      user,
      await teacherClassIds(env.DB, user),
    );
    if (portalResponse) return portalResponse;

    const getClassIds = () => teacherClassIds(env.DB, user);
    const schoolExamResponse = await handleSchoolExamRoutes(
      request,
      env,
      path,
      method,
      user,
      schoolExamIncidentParts,
      schoolExamExportCollectionParts,
      getClassIds,
    );
    if (schoolExamResponse) return schoolExamResponse;

    return await handleStaffCompetitionRoutes(request, env, path, method, user, getClassIds);
  } catch (error) {
    return routeError(error);
  }
}

function competitionOperation(method: string, path: string): string {
  if (/\/attempts\/[^/]+\/submit$/.test(path)) return 'student_round_attempt_submit';
  if (/\/rounds\/[^/]+\/attempts$/.test(path)) return 'student_round_attempt_start';
  if (/\/publish$/.test(path)) return 'school_exam_publish';
  if (/\/preflight$/.test(path)) return 'school_exam_preflight';
  if (/\/provision$/.test(path)) return 'school_exam_provision';
  if (/\/eligibility\/finalize$/.test(path)) return 'eligibility_finalize';
  return `${method.toLowerCase()}_competition_mutation`;
}

function competitionOperationContext(method: string, path: string, request: Request) {
  const segments = path.split('/').filter(Boolean);
  const studentCompetitionAt = segments.indexOf('competitions');
  const schoolExamAt = segments.indexOf('school-exams');
  return {
    operation: competitionOperation(method, path),
    campaignId: studentCompetitionAt >= 0 ? segments[studentCompetitionAt + 1] : undefined,
    eventId: schoolExamAt >= 0 ? segments[schoolExamAt + 1] : undefined,
    requestId: request.headers.get('x-request-id') || undefined,
  };
}

export async function handleCompetitionRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  if (!isMutation) return handleCompetitionRoutesCore(request, env, path, method);

  const startedAt = Date.now();
  const logger = createCompetitionEventLogger();
  const context = competitionOperationContext(method, path, request);
  try {
    const response = await handleCompetitionRoutesCore(request, env, path, method);
    if (response) {
      const metadata = { ...context, status: response.status, durationMs: Date.now() - startedAt };
      if (response.status >= 400) logger.warn('mutation_failed', metadata);
      else logger.info('mutation_completed', metadata);
    }
    return response;
  } catch (error) {
    logger.warn('mutation_failed', { ...context, status: 500, durationMs: Date.now() - startedAt });
    throw error;
  }
}
