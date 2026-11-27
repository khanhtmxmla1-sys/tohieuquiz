import {
  CreateCompetitionCertificateBatchRequestSchema,
  CreateCompetitionExportRequestSchema,
  CreateSchoolExamEventRequestSchema,
  CreateSchoolExamIncidentRequestSchema,
  CreateSchoolExamResultCorrectionRequestSchema,
  CreateSchoolExamRoomRequestSchema,
  GrantSchoolExamRetestRequestSchema,
  ProvisionSchoolExamRequestSchema,
  PublishCompetitionResultsRequestSchema,
  RunSchoolExamPreflightRequestSchema,
  StartCompetitionReconcileRequestSchema,
} from '../../../../schemas/competition.schema';
import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { requireAdmin } from '../../middleware/jwtAuth';
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
import { jsonBody, routeParts } from './routeSupport';

type ClassIdsLoader = () => Promise<string[] | undefined>;

export async function handleSchoolExamRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  user: JWTPayload,
  schoolExamIncidentParts: string[] | null,
  schoolExamExportCollectionParts: string[] | null,
  getClassIds: ClassIdsLoader,
): Promise<Response | null> {
  const schoolExamEventCreateParts = routeParts(
    path,
    /^\/api\/competitions\/([^/]+)\/school-exams$/,
  );
  if (schoolExamEventCreateParts && method === 'GET') {
    const [campaignId] = schoolExamEventCreateParts;
    const classIds = await getClassIds();
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
      const ownedClassIds = await getClassIds();
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

  return null;
}
