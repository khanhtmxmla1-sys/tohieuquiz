import { errorResponse } from '../../utils/response';
import { isStudent, requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { JWTPayload } from '../../utils/jwt';
import * as LiveExamService from '../../services/liveExamService';
import type { LiveExamRouteContext } from './routeContext';

export type RouteAuth<T> = { data: T } | { response: Response };

export function isAuthResponse<T>(result: RouteAuth<T>): result is { response: Response } {
  return 'response' in result;
}

export async function authenticateUser(
  context: LiveExamRouteContext,
): Promise<RouteAuth<JWTPayload>> {
  const authResult = await verifyJWTMiddleware(context.request, context.env);
  return authResult instanceof Response
    ? { response: authResult }
    : { data: authResult.user };
}

export async function authenticateTeacher(
  context: LiveExamRouteContext,
): Promise<RouteAuth<JWTPayload>> {
  const auth = await authenticateUser(context);
  if (isAuthResponse(auth)) return auth;
  if (!requireTeacher(auth.data)) {
    return { response: errorResponse('Forbidden: Teacher access required', 403) };
  }
  return auth;
}

export async function authorizeTeacherForSession(
  context: LiveExamRouteContext,
  user: JWTPayload,
  sessionId: string,
): Promise<Response | null> {
  if (!requireTeacher(user)) {
    return errorResponse('Forbidden: Teacher access required', 403);
  }
  const session = await LiveExamService.getLiveExamById(context.db, sessionId);
  if (!session) return errorResponse('Session not found', 404);
  if (user.role === 'admin') return null;

  const teacherIdentifier = user.id || user.username;
  const isOwner = session.teacherId === user.username
    || session.teacherId === teacherIdentifier
    || session.teacherId === String(user.id);
  return isOwner
    ? null
    : errorResponse('Forbidden: You do not own this session', 403);
}

export async function authenticateTeacherForSession(
  context: LiveExamRouteContext,
  sessionId: string,
): Promise<RouteAuth<JWTPayload>> {
  const auth = await authenticateUser(context);
  if (isAuthResponse(auth)) return auth;
  const authError = await authorizeTeacherForSession(context, auth.data, sessionId);
  return authError ? { response: authError } : auth;
}

export async function resolveAuthenticatedStudentId(
  db: D1Database,
  user: JWTPayload,
): Promise<string | null> {
  if (user.id !== undefined && user.id !== null) return String(user.id);
  const student = await db
    .prepare('SELECT id FROM students WHERE username = ?')
    .bind(user.username)
    .first<{ id: string }>();
  return student?.id || null;
}

export async function authenticateStudent(
  context: LiveExamRouteContext,
): Promise<RouteAuth<{ user: JWTPayload; studentId: string }>> {
  const auth = await authenticateUser(context);
  if (isAuthResponse(auth)) return auth;
  if (!isStudent(auth.data)) {
    return { response: errorResponse('Forbidden: Student access required', 403) };
  }

  const studentId = await resolveAuthenticatedStudentId(context.db, auth.data);
  return studentId
    ? { data: { user: auth.data, studentId } }
    : { response: errorResponse('Student not found', 404) };
}

export async function requireStudentParticipant(
  db: D1Database,
  sessionId: string,
  studentId: string,
): Promise<any | null> {
  return db.prepare(
    'SELECT * FROM live_exam_participants WHERE live_exam_id = ? AND student_id = ?',
  ).bind(sessionId, studentId).first<any>();
}
