import {
  CreateCompetitionCampaignRequestSchema,
  CreateCompetitionCertificateBatchRequestSchema,
  CreateCompetitionExportRequestSchema,
  CreateSchoolExamEventRequestSchema,
  CreateSchoolExamIncidentRequestSchema,
  CreateSchoolExamResultCorrectionRequestSchema,
  CreateSchoolExamRoomRequestSchema,
  GrantSchoolExamRetestRequestSchema,
  FinalizeCompetitionEligibilityRequestSchema,
  FinalizeCompetitionRoundRequestSchema,
  ProvisionSchoolExamRequestSchema,
  PublishCompetitionResultsRequestSchema,
  RunSchoolExamPreflightRequestSchema,
  StartCompetitionReconcileRequestSchema,
  StartCompetitionRoundAttemptRequestSchema,
  SubmitCompetitionRoundAttemptRequestSchema,
  UpdateCompetitionCampaignRequestSchema,
  UpdateCompetitionRoundRequestSchema,
  UpsertCompetitionRoundQuizRequestSchema,
} from '../../../../schemas/competition.schema';
import type { Env } from '../../types';
import { requireAdmin, requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import {
  createCompetitionCampaign,
  freezeCompetitionAudience,
  getCompetitionCampaign,
  listCompetitionAudience,
  listCompetitionCampaigns,
  previewCompetitionAudience,
  updateCompetitionCampaign,
} from '../../competition/campaignService';
import {
  finalizeCompetitionEligibility,
  getStudentCompetitionEligibility,
  listCompetitionEligibility,
} from '../../competition/eligibilityService';
import {
  finalizeCompetitionRound,
  listCompetitionProgress,
  listCompetitionRounds,
  getRoundAttemptQuiz,
  startRoundAttempt,
  submitRoundAttempt,
  updateCompetitionRound,
  upsertCompetitionRoundQuiz,
} from '../../competition/roundService';
import {
  getStudentCompetition,
  getStudentOfficialCompetitionResult,
  listStudentCompetitions,
} from '../../competition/studentCompetitionService';
import { createCompetitionEventLogger } from '../../competition/observability';
import {
  createSchoolExamEvent,
  createSchoolExamRoom,
  getSchoolExamEvent,
  listSchoolExamEvents,
  provisionSchoolExam,
  runSchoolExamPreflight,
} from '../../competition/schoolExamService';
import {
  getSchoolExamReconcile,
  reconcileSchoolExam,
} from '../../competition/schoolExamReconcileService';
import {
  grantSchoolExamRetest,
  listSchoolExamIncidents,
  listSchoolExamRetests,
  reportSchoolExamIncident,
} from '../../competition/schoolExamIncidentRetestService';
import {
  getSchoolExamRankings,
  publishSchoolExamResults,
  type SchoolExamRankingScope,
} from '../../competition/schoolExamPublicationRankingService';
import {
  createSchoolExamCertificateBatches,
  getSchoolExamCertificateBatch,
} from '../../competition/schoolExamCertificateService';
import {
  createSchoolExamResultCorrection,
  listSchoolExamResultCorrections,
} from '../../competition/schoolExamResultCorrectionService';
import {
  createSchoolExamExport,
  downloadSchoolExamExport,
  getSchoolExamExport,
} from '../../competition/schoolExamExportService';
import { errorResponse, jsonResponse } from '../../utils/response';
import type { JWTPayload } from '../../utils/jwt';
import { handleCompetitionPortalRoutes } from './portalRoutes';

function routeCampaignId(path: string, suffix = ''): string | null {
  const prefix = '/api/competitions/';
  if (!path.startsWith(prefix)) return null;

  const remainder = path.slice(prefix.length);
  if (suffix) {
    if (!remainder.endsWith(suffix)) return null;
    const rawId = remainder.slice(0, -suffix.length);
    if (!rawId || rawId.includes('/')) return null;
    return decodeURIComponent(rawId);
  }

  if (!remainder || remainder.includes('/')) return null;
  return decodeURIComponent(remainder);
}

function routeParts(path: string, pattern: RegExp): string[] | null {
  const match = path.match(pattern);
  if (!match) return null;
  try {
    return match.slice(1).map((value) => decodeURIComponent(value));
  } catch {
    return null;
  }
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

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

function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'COMPETITION_REQUEST_FAILED';
  if ([
    'COMPETITION_CAMPAIGN_NOT_FOUND',
    'COMPETITION_ROUND_NOT_FOUND',
    'COMPETITION_ROUND_CLASS_NOT_FOUND',
    'COMPETITION_ATTEMPT_NOT_FOUND',
    'COMPETITION_ROUND_QUIZ_NOT_FOUND',
    'COMPETITION_ELIGIBILITY_VERSION_NOT_FOUND',
    'SCHOOL_EXAM_EVENT_NOT_FOUND',
    'SCHOOL_EXAM_ROOM_NOT_FOUND',
    'SCHOOL_EXAM_CAPACITY_PROFILE_NOT_FOUND',
    'SCHOOL_EXAM_RECONCILE_NOT_FOUND',
    'SCHOOL_EXAM_INCIDENT_NOT_FOUND',
    'SCHOOL_EXAM_RETEST_NOT_FOUND',
    'SCHOOL_EXAM_ORIGINAL_RESULT_NOT_FOUND',
    'SCHOOL_EXAM_PUBLICATION_NOT_FOUND',
    'SCHOOL_EXAM_CORRECTION_RESULT_NOT_FOUND',
    'SCHOOL_EXAM_CERTIFICATE_PUBLICATION_NOT_FOUND',
    'SCHOOL_EXAM_CERTIFICATE_TEMPLATE_NOT_FOUND',
    'SCHOOL_EXAM_CERTIFICATE_NOT_FOUND',
    'SCHOOL_EXAM_EXPORT_NOT_FOUND',
    'SCHOOL_EXAM_EXPORT_ARTIFACT_NOT_FOUND',
  ].includes(message)) return errorResponse(message, 404);
  if ([
    'COMPETITION_CAMPAIGN_NOT_DRAFT',
    'COMPETITION_AUDIENCE_NOT_SNAPSHOTTED',
    'COMPETITION_ELIGIBILITY_NOT_FINALIZED',
    'COMPETITION_ELIGIBILITY_ROUNDS_NOT_READY',
    'COMPETITION_ELIGIBILITY_ROUNDS_NOT_FINALIZED',
    'COMPETITION_ELIGIBILITY_PROGRESS_INCOMPLETE',
    'COMPETITION_ROUND_NOT_OPEN',
    'COMPETITION_MAX_ATTEMPTS_REACHED',
    'COMPETITION_ROUND_FINALIZED',
    'COMPETITION_ROUND_CONFIG_LOCKED',
    'COMPETITION_ROUND_NOT_CLOSED',
    'COMPETITION_ATTEMPT_NOT_SUBMITTABLE',
    'COMPETITION_ATTEMPT_EXPIRED',
    'COMPETITION_QUIZ_SNAPSHOT_HASH_MISMATCH',
    'SCHOOL_EXAM_EVENT_CONFIG_LOCKED',
    'SCHOOL_EXAM_ROOM_MEMBER_NOT_QUALIFIED',
    'SCHOOL_EXAM_ROOM_MEMBERS_INVALID',
    'SCHOOL_EXAM_MEMBER_ALREADY_ASSIGNED',
    'SCHOOL_EXAM_SAME_FORM_REQUIRED',
    'SCHOOL_EXAM_EQUIVALENT_FORM_APPROVAL_REQUIRED',
    'SCHOOL_EXAM_EQUIVALENT_FORM_MISMATCH',
    'SCHOOL_EXAM_FORM_DEFINITION_INVALID',
    'SCHOOL_EXAM_FORM_DURATION_MISMATCH',
    'SCHOOL_EXAM_FORM_GRADE_MISMATCH',
    'SCHOOL_EXAM_FORM_DIFFICULTY_MISMATCH',
    'SCHOOL_EXAM_ROOMS_REQUIRED',
    'SCHOOL_EXAM_PREFLIGHT_REQUIRED',
    'SCHOOL_EXAM_RECONCILE_PUBLISHED_LOCKED',
    'SCHOOL_EXAM_RETEST_PUBLISHED_LOCKED',
    'SCHOOL_EXAM_RETEST_NOT_REQUESTED',
    'SCHOOL_EXAM_RETEST_LINEAGE_INVALID',
    'SCHOOL_EXAM_RETEST_EXPIRY_INVALID',
    'SCHOOL_EXAM_INCIDENT_REQUEST_CONFLICT',
    'SCHOOL_EXAM_PUBLISH_NOT_READY',
    'SCHOOL_EXAM_PUBLISH_RESULTS_REQUIRED',
    'SCHOOL_EXAM_PUBLISH_RECONCILE_VERSION_REQUIRED',
    'SCHOOL_EXAM_CORRECTION_NOT_PUBLISHED',
    'SCHOOL_EXAM_CORRECTION_IDEMPOTENCY_CONFLICT',
    'SCHOOL_EXAM_CORRECTION_PENDING_EXISTS',
    'SCHOOL_EXAM_CORRECTION_NO_CHANGE',
    'SCHOOL_EXAM_CERTIFICATE_WINNER_INVALID',
    'SCHOOL_EXAM_CERTIFICATE_CLASS_BATCH_TOO_LARGE',
    'SCHOOL_EXAM_CERTIFICATE_REQUEST_CONFLICT',
    'SCHOOL_EXAM_EXPORT_PUBLICATION_NOT_FOUND',
    'SCHOOL_EXAM_EXPORT_CLASS_NOT_IN_PUBLICATION',
    'SCHOOL_EXAM_EXPORT_NOT_READY',
    'SCHOOL_EXAM_EXPORT_EMPTY_SCOPE',
  ].includes(message)) return errorResponse(message, 409);
  if ([
    'COMPETITION_STUDENT_NOT_IN_AUDIENCE',
    'COMPETITION_ADMIN_REQUIRED',
    'SCHOOL_EXAM_EVENT_FORBIDDEN',
    'SCHOOL_EXAM_INCIDENT_FORBIDDEN',
    'SCHOOL_EXAM_EXPORT_FORBIDDEN',
  ].includes(message)) return errorResponse(message, 403);
  if ([
    'COMPETITION_LIMIT_INVALID',
    'COMPETITION_PROGRESS_CURSOR_INVALID',
    'COMPETITION_ELIGIBILITY_CURSOR_INVALID',
    'SCHOOL_EXAM_INCIDENT_CURSOR_INVALID',
    'SCHOOL_EXAM_RETEST_CURSOR_INVALID',
    'SCHOOL_EXAM_RECONCILE_CURSOR_INVALID',
    'SCHOOL_EXAM_CORRECTION_CURSOR_INVALID',
    'SCHOOL_EXAM_RANKING_CURSOR_INVALID',
  ].includes(message)) return errorResponse(message, 400);
  if ([
    'CERTIFICATE_QUEUE_UNAVAILABLE',
    'SCHOOL_EXAM_CERTIFICATE_QUEUE_FAILED',
    'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED',
    'SCHOOL_EXAM_EXPORT_QUEUE_UNAVAILABLE',
    'SCHOOL_EXAM_EXPORT_QUEUE_FAILED',
    'SCHOOL_EXAM_EXPORT_PERSIST_FAILED',
    'SCHOOL_EXAM_EXPORT_STORAGE_UNAVAILABLE',
  ].includes(message)) return errorResponse(message, 503);
  if (message === 'COMPETITION_AUDIENCE_CURSOR_INVALID') return errorResponse(message, 400);
  return errorResponse(message, 400);
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

  if (isStudentNamespace) {
    if (user.role !== 'student') return errorResponse('Forbidden', 403);
    try {
      const studentId = await authenticatedStudentId(env.DB, user);
      if (!studentId) return errorResponse('Unauthorized: Student identity not found', 401);

      const studentEligibilityParts = routeParts(
        path,
        /^\/api\/student\/competitions\/([^/]+)\/eligibility$/,
      );
      if (path === '/api/student/competitions' && method === 'GET') {
        const items = await listStudentCompetitions(env.DB, studentId);
        return jsonResponse({ items });
      }

      const studentOfficialResultParts = routeParts(
        path,
        /^\/api\/student\/competitions\/([^/]+)\/official-result$/,
      );
      if (studentOfficialResultParts && method === 'GET') {
        const [campaignId] = studentOfficialResultParts;
        const result = await getStudentOfficialCompetitionResult(env.DB, campaignId, studentId);
        return jsonResponse({ result });
      }

      const studentCompetitionParts = routeParts(path, /^\/api\/student\/competitions\/([^/]+)$/);
      if (studentCompetitionParts && method === 'GET') {
        const [campaignId] = studentCompetitionParts;
        const competition = await getStudentCompetition(env.DB, campaignId, studentId);
        return jsonResponse({ competition });
      }

      if (studentEligibilityParts && method === 'GET') {
        const [campaignId] = studentEligibilityParts;
        const eligibility = await getStudentCompetitionEligibility(env.DB, campaignId, studentId);
        return jsonResponse({ eligibility });
      }

      const startParts = routeParts(
        path,
        /^\/api\/student\/competitions\/([^/]+)\/rounds\/([^/]+)\/attempts$/,
      );
      if (startParts && method === 'POST') {
        const [campaignId, roundId] = startParts;
        const body = await jsonBody(request);
        if (!body) return errorResponse('Invalid JSON body', 400);
        const parsed = StartCompetitionRoundAttemptRequestSchema.safeParse(body);
        if (!parsed.success) return errorResponse('Invalid competition attempt payload', 400);
        if (parsed.data.campaignId !== campaignId || parsed.data.roundId !== roundId) {
          return errorResponse('COMPETITION_ROUND_ROUTE_MISMATCH', 400);
        }
        const attempt = await startRoundAttempt(env.DB, {
          campaignId,
          roundId,
          studentId,
          requestId: parsed.data.requestId,
        });
        const quiz = await getRoundAttemptQuiz(env.DB, attempt.id, studentId);
        return jsonResponse({ attempt, quiz }, 201);
      }

      const submitParts = routeParts(
        path,
        /^\/api\/student\/competitions\/([^/]+)\/rounds\/([^/]+)\/attempts\/([^/]+)\/submit$/,
      );
      if (submitParts && method === 'POST') {
        const [campaignId, roundId, attemptId] = submitParts;
        const body = await jsonBody(request);
        if (!body) return errorResponse('Invalid JSON body', 400);
        const parsed = SubmitCompetitionRoundAttemptRequestSchema.safeParse(body);
        if (!parsed.success) return errorResponse('Invalid competition attempt submit payload', 400);
        if (parsed.data.attemptId !== attemptId) return errorResponse('COMPETITION_ATTEMPT_ROUTE_MISMATCH', 400);
        const result = await submitRoundAttempt(env.DB, {
          attemptId,
          studentId,
          campaignId,
          roundId,
          answers: parsed.data.answers,
          timeTaken: parsed.data.timeTaken,
          requestId: parsed.data.idempotencyKey,
        });
        return jsonResponse({ result });
      }

      return null;
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

    const schoolExamEventCreateParts = routeParts(
      path,
      /^\/api\/competitions\/([^/]+)\/school-exams$/,
    );
    if (schoolExamEventCreateParts && method === 'GET') {
      const [campaignId] = schoolExamEventCreateParts;
      const classIds = await teacherClassIds(env.DB, user);
      const items = await listSchoolExamEvents(env.DB, campaignId, { classIds });
      return jsonResponse({ items });
    }
    if (schoolExamEventCreateParts && method === 'POST') {
      const [campaignId] = schoolExamEventCreateParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateSchoolExamEventRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam event payload', 400);
      if (parsed.data.campaignId !== campaignId) return errorResponse('SCHOOL_EXAM_CAMPAIGN_ROUTE_MISMATCH', 400);
      const event = await createSchoolExamEvent(env.DB, parsed.data, user.username);
      return jsonResponse({ event }, 201);
    }

    const schoolExamDetailParts = routeParts(path, /^\/api\/school-exams\/([^/]+)$/);
    if (schoolExamDetailParts && method === 'GET') {
      const [eventId] = schoolExamDetailParts;
      const event = await getSchoolExamEvent(env.DB, eventId, { username: user.username, role: user.role });
      return jsonResponse({ event });
    }

    const schoolExamRoomParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/rooms$/);
    if (schoolExamRoomParts && method === 'POST') {
      const [eventId] = schoolExamRoomParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateSchoolExamRoomRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam room payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const result = await createSchoolExamRoom(env.DB, parsed.data, user.username);
      return jsonResponse(result, 201);
    }

    const schoolExamPreflightParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/preflight$/);
    if (schoolExamPreflightParts && method === 'POST') {
      const [eventId] = schoolExamPreflightParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = RunSchoolExamPreflightRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam preflight payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const preflight = await runSchoolExamPreflight(env.DB, eventId, user.username, parsed.data.requestId);
      return jsonResponse({ preflight }, preflight.status === 'PREFLIGHT_BLOCKED' ? 409 : 200);
    }

    const schoolExamProvisionParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/provision$/);
    if (schoolExamProvisionParts && method === 'POST') {
      const [eventId] = schoolExamProvisionParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = ProvisionSchoolExamRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam provision payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const provision = await provisionSchoolExam(env.DB, eventId, user.username, parsed.data.requestId);
      return jsonResponse({ provision }, provision.failed > 0 ? 207 : 200);
    }

    if (schoolExamIncidentParts && method === 'GET') {
      const [eventId] = schoolExamIncidentParts;
      const url = new URL(request.url);
      const page = await listSchoolExamIncidents(
        env.DB,
        eventId,
        { username: user.username, role: user.role },
        { limit: url.searchParams.get('limit') || undefined, cursor: url.searchParams.get('cursor') || undefined },
      );
      return jsonResponse(page);
    }
    if (schoolExamIncidentParts && method === 'POST') {
      const [eventId] = schoolExamIncidentParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateSchoolExamIncidentRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam incident payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const result = await reportSchoolExamIncident(env.DB, parsed.data, {
        username: user.username,
        role: user.role,
      });
      return jsonResponse(result, 201);
    }

    const schoolExamRetestCollectionParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/retests$/);
    if (schoolExamRetestCollectionParts && method === 'GET') {
      const [eventId] = schoolExamRetestCollectionParts;
      const url = new URL(request.url);
      const page = await listSchoolExamRetests(
        env.DB,
        eventId,
        { username: user.username, role: user.role },
        { limit: url.searchParams.get('limit') || undefined, cursor: url.searchParams.get('cursor') || undefined },
      );
      return jsonResponse(page);
    }

    const schoolExamRetestGrantParts = routeParts(
      path,
      /^\/api\/school-exams\/([^/]+)\/retests\/([^/]+)\/grant$/,
    );
    if (schoolExamRetestGrantParts && method === 'POST') {
      const [eventId, retestId] = schoolExamRetestGrantParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = GrantSchoolExamRetestRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam retest grant payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const retest = await grantSchoolExamRetest(
        env.DB,
        eventId,
        retestId,
        {
          expiresAt: parsed.data.expiresAt,
          resolution: parsed.data.resolution,
          requestId: parsed.data.requestId,
        },
        user.username,
      );
      return jsonResponse({ retest }, 201);
    }

    const schoolExamReconcileParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/reconcile$/);
    if (schoolExamReconcileParts && method === 'POST') {
      const [eventId] = schoolExamReconcileParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = StartCompetitionReconcileRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam reconcile payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const reconcile = await reconcileSchoolExam(env.DB, eventId, user.username, parsed.data.requestId);
      return jsonResponse({ reconcile });
    }
    if (schoolExamReconcileParts && method === 'GET') {
      const [eventId] = schoolExamReconcileParts;
      await getSchoolExamEvent(env.DB, eventId, { username: user.username, role: user.role });
      const url = new URL(request.url);
      const reconcile = await getSchoolExamReconcile(env.DB, eventId, {
        limit: url.searchParams.get('limit') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
      });
      return jsonResponse({ reconcile });
    }

    const schoolExamPublishParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/publish$/);
    if (schoolExamPublishParts && method === 'POST') {
      const [eventId] = schoolExamPublishParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = PublishCompetitionResultsRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam publish payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const publication = await publishSchoolExamResults(env.DB, eventId, user.username, parsed.data.requestId);
      return jsonResponse({ publication }, 201);
    }

    const schoolExamCorrectionParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/corrections$/);
    if (schoolExamCorrectionParts && method === 'POST') {
      if (!requireAdmin(user)) return errorResponse('COMPETITION_ADMIN_REQUIRED', 403);
      const [eventId] = schoolExamCorrectionParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateSchoolExamResultCorrectionRequestSchema.safeParse({ ...body, eventId });
      if (!parsed.success) return errorResponse('Invalid school exam correction payload', 400);
      const result = await createSchoolExamResultCorrection(env.DB, eventId, {
        studentId: parsed.data.studentId,
        score: parsed.data.score,
        correctCount: parsed.data.correctCount,
        timeTaken: parsed.data.timeTaken,
        reason: parsed.data.reason,
        requestId: parsed.data.requestId,
      }, user.username);
      return jsonResponse({ correction: result.correction }, result.created ? 201 : 200);
    }
    if (schoolExamCorrectionParts && method === 'GET') {
      if (!requireAdmin(user)) return errorResponse('COMPETITION_ADMIN_REQUIRED', 403);
      const [eventId] = schoolExamCorrectionParts;
      const url = new URL(request.url);
      const page = await listSchoolExamResultCorrections(env.DB, eventId, {
        limit: url.searchParams.get('limit') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
      });
      return jsonResponse(page);
    }

    const schoolExamRankingParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/rankings$/);
    if (schoolExamRankingParts && method === 'GET') {
      const [eventId] = schoolExamRankingParts;
      const url = new URL(request.url);
      const scope = String(url.searchParams.get('scope') || 'EVENT').toUpperCase() as SchoolExamRankingScope;
      const gradeLevelValue = url.searchParams.get('gradeLevel');
      const classId = url.searchParams.get('classId') ? String(url.searchParams.get('classId')) : undefined;
      await getSchoolExamEvent(env.DB, eventId);
      if (!requireAdmin(user)) {
        const ownedClassIds = await teacherClassIds(env.DB, user);
        if (scope !== 'CLASS' || !classId || !ownedClassIds?.includes(classId)) {
          return errorResponse('SCHOOL_EXAM_RANKING_FORBIDDEN', 403);
        }
      }
      const rankings = await getSchoolExamRankings(env.DB, eventId, {
        scope,
        ...(gradeLevelValue === null ? {} : { gradeLevel: Number(gradeLevelValue) }),
        ...(classId ? { classId } : {}),
        limit: url.searchParams.get('limit') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
      });
      return jsonResponse({ rankings });
    }

    if (schoolExamExportCollectionParts && method === 'POST') {
      const [eventId] = schoolExamExportCollectionParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateCompetitionExportRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam export payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const result = await createSchoolExamExport(env, parsed.data, {
        username: user.username,
        role: user.role,
      });
      return jsonResponse({ export: result.export }, result.created ? 201 : 200);
    }

    const schoolExamExportDownloadParts = routeParts(
      path,
      /^\/api\/school-exams\/([^/]+)\/exports\/([^/]+)\/download$/,
    );
    if (schoolExamExportDownloadParts && method === 'GET') {
      const [eventId, exportId] = schoolExamExportDownloadParts;
      return await downloadSchoolExamExport(env, eventId, exportId, { username: user.username, role: user.role });
    }

    const schoolExamExportDetailParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/exports\/([^/]+)$/);
    if (schoolExamExportDetailParts && method === 'GET') {
      const [eventId, exportId] = schoolExamExportDetailParts;
      const exportJob = await getSchoolExamExport(env.DB, eventId, exportId, { username: user.username, role: user.role });
      return jsonResponse({ export: exportJob });
    }

    const schoolExamCertificateDetailParts = routeParts(
      path,
      /^\/api\/school-exams\/([^/]+)\/certificates\/([^/]+)$/,
    );
    if (schoolExamCertificateDetailParts && method === 'GET') {
      if (!requireAdmin(user)) return errorResponse('COMPETITION_ADMIN_REQUIRED', 403);
      const [eventId, parentId] = schoolExamCertificateDetailParts;
      const certificateBatch = await getSchoolExamCertificateBatch(env.DB, eventId, parentId);
      return jsonResponse({ certificateBatch });
    }

    const schoolExamCertificateParts = routeParts(path, /^\/api\/school-exams\/([^/]+)\/certificates$/);
    if (schoolExamCertificateParts && method === 'POST') {
      const [eventId] = schoolExamCertificateParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateCompetitionCertificateBatchRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid school exam certificate payload', 400);
      if (parsed.data.eventId !== eventId) return errorResponse('SCHOOL_EXAM_EVENT_ROUTE_MISMATCH', 400);
      const result = await createSchoolExamCertificateBatches(env, parsed.data, user.username);
      return jsonResponse(
        { certificateBatch: result.certificateBatch },
        result.created ? 201 : 200,
      );
    }

    if (path === '/api/competitions' && method === 'POST') {
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = CreateCompetitionCampaignRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition campaign payload', 400);
      const campaign = await createCompetitionCampaign(env.DB, parsed.data, user.username);
      return jsonResponse({ campaign }, 201);
    }

    if (path === '/api/competitions' && method === 'GET') {
      const items = await listCompetitionCampaigns(env.DB);
      return jsonResponse({ items });
    }

    const previewCampaignId = routeCampaignId(path, '/audience/preview');
    if (previewCampaignId && method === 'POST') {
      const preview = await previewCompetitionAudience(env.DB, previewCampaignId);
      return jsonResponse({ preview });
    }

    const snapshotCampaignId = routeCampaignId(path, '/audience/snapshot');
    if (snapshotCampaignId && method === 'POST') {
      const body = await jsonBody(request);
      const requestId = String(body?.requestId || '').trim();
      if (requestId.length < 8) return errorResponse('requestId is required', 400);
      const snapshot = await freezeCompetitionAudience(
        env.DB,
        snapshotCampaignId,
        user.username,
        requestId,
      );
      return jsonResponse({ snapshot }, 201);
    }

    const audienceCampaignId = routeCampaignId(path, '/audience');
    if (audienceCampaignId && method === 'GET') {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit') || 50);
      const cursor = url.searchParams.get('cursor') || undefined;
      const classIds = await teacherClassIds(env.DB, user);
      const audience = await listCompetitionAudience(env.DB, audienceCampaignId, {
        limit,
        cursor,
        classIds,
      });
      return jsonResponse(audience);
    }

    const eligibilityFinalizeParts = routeParts(
      path,
      /^\/api\/competitions\/([^/]+)\/eligibility\/finalize$/,
    );
    if (eligibilityFinalizeParts && method === 'POST') {
      const [campaignId] = eligibilityFinalizeParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = FinalizeCompetitionEligibilityRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition eligibility finalize payload', 400);
      if (parsed.data.campaignId !== campaignId) {
        return errorResponse('COMPETITION_ELIGIBILITY_ROUTE_MISMATCH', 400);
      }
      const snapshot = await finalizeCompetitionEligibility(
        env.DB,
        campaignId,
        user.username,
        parsed.data.requestId,
      );
      return jsonResponse({ snapshot });
    }

    const eligibilityParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/eligibility$/);
    if (eligibilityParts && method === 'GET') {
      const [campaignId] = eligibilityParts;
      const url = new URL(request.url);
      const rawVersion = url.searchParams.get('version');
      const parsedVersion = rawVersion === null ? undefined : Number(rawVersion);
      if (parsedVersion !== undefined && (!Number.isInteger(parsedVersion) || parsedVersion <= 0)) {
        return errorResponse('COMPETITION_ELIGIBILITY_VERSION_INVALID', 400);
      }
      const classIds = await teacherClassIds(env.DB, user);
      const eligibility = await listCompetitionEligibility(env.DB, campaignId, {
        version: parsedVersion,
        classIds,
        limit: url.searchParams.get('limit') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
      });
      return jsonResponse(eligibility);
    }

    const progressParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/progress$/);
    if (progressParts && method === 'GET') {
      const [campaignId] = progressParts;
      const url = new URL(request.url);
      const classIds = await teacherClassIds(env.DB, user);
      const progress = await listCompetitionProgress(env.DB, campaignId, {
        classIds,
        limit: url.searchParams.get('limit') || undefined,
        cursor: url.searchParams.get('cursor') || undefined,
      });
      return jsonResponse(progress);
    }

    const roundListParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/rounds$/);
    if (roundListParts && method === 'GET') {
      const [campaignId] = roundListParts;
      const items = await listCompetitionRounds(env.DB, campaignId);
      return jsonResponse({ items });
    }

    const roundQuizParts = routeParts(
      path,
      /^\/api\/competitions\/([^/]+)\/rounds\/([^/]+)\/quizzes$/,
    );
    if (roundQuizParts && method === 'PUT') {
      const [campaignId, roundId] = roundQuizParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = UpsertCompetitionRoundQuizRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition round quiz payload', 400);
      if (parsed.data.campaignId !== campaignId || parsed.data.roundId !== roundId) {
        return errorResponse('COMPETITION_ROUND_ROUTE_MISMATCH', 400);
      }
      const mapping = await upsertCompetitionRoundQuiz(
        env.DB,
        campaignId,
        roundId,
        parsed.data,
        user.username,
      );
      return jsonResponse({ mapping });
    }

    const roundFinalizeParts = routeParts(
      path,
      /^\/api\/competitions\/([^/]+)\/rounds\/([^/]+)\/finalize$/,
    );
    if (roundFinalizeParts && method === 'POST') {
      const [campaignId, roundId] = roundFinalizeParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = FinalizeCompetitionRoundRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition round finalize payload', 400);
      if (parsed.data.campaignId !== campaignId || parsed.data.roundId !== roundId) {
        return errorResponse('COMPETITION_ROUND_ROUTE_MISMATCH', 400);
      }
      const round = await finalizeCompetitionRound(
        env.DB,
        campaignId,
        roundId,
        user.username,
        parsed.data.requestId,
      );
      return jsonResponse({ round });
    }

    const roundPatchParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/rounds\/([^/]+)$/);
    if (roundPatchParts && method === 'PATCH') {
      const [campaignId, roundId] = roundPatchParts;
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = UpdateCompetitionRoundRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition round payload', 400);
      const round = await updateCompetitionRound(env.DB, campaignId, roundId, parsed.data, user.username);
      return jsonResponse({ round });
    }

    const campaignId = routeCampaignId(path);
    if (campaignId && method === 'GET') {
      const campaign = await getCompetitionCampaign(env.DB, campaignId);
      if (!campaign) return errorResponse('COMPETITION_CAMPAIGN_NOT_FOUND', 404);
      return jsonResponse({ campaign });
    }

    if (campaignId && method === 'PATCH') {
      const body = await jsonBody(request);
      if (!body) return errorResponse('Invalid JSON body', 400);
      const parsed = UpdateCompetitionCampaignRequestSchema.safeParse(body);
      if (!parsed.success) return errorResponse('Invalid competition campaign payload', 400);
      const campaign = await updateCompetitionCampaign(env.DB, campaignId, parsed.data, user.username);
      return jsonResponse({ campaign });
    }

    return null;
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
