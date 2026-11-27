import {
  ApproveCompetitionSchoolExamAdmissionsRequestSchema,
  CreateCompetitionCampaignRequestSchema,
  FinalizeCompetitionEligibilityRequestSchema,
  FinalizeCompetitionRoundRequestSchema,
  UpdateCompetitionCampaignRequestSchema,
  UpdateCompetitionRoundRequestSchema,
  UpsertCompetitionRoundQuizRequestSchema,
} from '../../../../schemas/competition.schema';
import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
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
  listCompetitionEligibility,
} from '../../competition/eligibilityService';
import {
  approveCompetitionSchoolExamAdmissions,
  buildCompetitionSchoolExamAdmissionsWorkbook,
  listCompetitionSchoolExamAdmissions,
} from '../../competition/schoolExamAdmissionService';
import {
  finalizeCompetitionRound,
  listCompetitionProgress,
  listCompetitionRounds,
  updateCompetitionRound,
  upsertCompetitionRoundQuiz,
} from '../../competition/roundService';
import { errorResponse, jsonResponse } from '../../utils/response';
import { jsonBody, routeCampaignId, routeParts } from './routeSupport';

type ClassIdsLoader = () => Promise<string[] | undefined>;

export async function handleStaffCompetitionRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  user: JWTPayload,
  getClassIds: ClassIdsLoader,
): Promise<Response | null> {
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
    const expectedMemberCount = body?.expectedMemberCount;
    if (expectedMemberCount !== undefined
      && (typeof expectedMemberCount !== 'number'
        || !Number.isInteger(expectedMemberCount)
        || expectedMemberCount < 0)) {
      return errorResponse('expectedMemberCount is required', 400);
    }
    const snapshot = await freezeCompetitionAudience(
      env.DB,
      snapshotCampaignId,
      user.username,
      requestId,
      expectedMemberCount === undefined ? undefined : Number(expectedMemberCount),
    );
    return jsonResponse({ snapshot }, 201);
  }

  const audienceCampaignId = routeCampaignId(path, '/audience');
  if (audienceCampaignId && method === 'GET') {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 50);
    const cursor = url.searchParams.get('cursor') || undefined;
    const classIds = await getClassIds();
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
    const classIds = await getClassIds();
    const eligibility = await listCompetitionEligibility(env.DB, campaignId, {
      version: parsedVersion,
      classIds,
      limit: url.searchParams.get('limit') || undefined,
      cursor: url.searchParams.get('cursor') || undefined,
    });
    return jsonResponse(eligibility);
  }

  const admissionExportParts = routeParts(
    path,
    /^\/api\/competitions\/([^/]+)\/school-exam-admissions\/export$/,
  );
  if (admissionExportParts && method === 'GET') {
    const [campaignId] = admissionExportParts;
    const url = new URL(request.url);
    const rawVersion = url.searchParams.get('version');
    const version = rawVersion === null ? undefined : Number(rawVersion);
    if (version !== undefined && (!Number.isInteger(version) || version <= 0)) {
      return errorResponse('COMPETITION_ELIGIBILITY_VERSION_INVALID', 400);
    }
    const classIds = await getClassIds();
    const workbook = await buildCompetitionSchoolExamAdmissionsWorkbook(env.DB, campaignId, { version, classIds });
    return new Response(workbook, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="competition-${campaignId.replace(/[^A-Za-z0-9_-]+/g, '-')}-qualified-students.xlsx"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const admissionParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/school-exam-admissions$/);
  if (admissionParts && method === 'GET') {
    const [campaignId] = admissionParts;
    const url = new URL(request.url);
    const rawVersion = url.searchParams.get('version');
    const version = rawVersion === null ? undefined : Number(rawVersion);
    if (version !== undefined && (!Number.isInteger(version) || version <= 0)) {
      return errorResponse('COMPETITION_ELIGIBILITY_VERSION_INVALID', 400);
    }
    const classIds = await getClassIds();
    return jsonResponse(await listCompetitionSchoolExamAdmissions(env.DB, campaignId, {
      version,
      classIds,
      limit: url.searchParams.get('limit') || undefined,
      cursor: url.searchParams.get('cursor') || undefined,
    }));
  }
  if (admissionParts && method === 'POST') {
    const [campaignId] = admissionParts;
    const body = await jsonBody(request);
    if (!body) return errorResponse('Invalid JSON body', 400);
    const parsed = ApproveCompetitionSchoolExamAdmissionsRequestSchema.safeParse(body);
    if (!parsed.success) return errorResponse('Invalid school exam admission payload', 400);
    if (parsed.data.campaignId !== campaignId) return errorResponse('COMPETITION_SCHOOL_EXAM_ADMISSION_ROUTE_MISMATCH', 400);
    if (parsed.data.approveAllQualified && parsed.data.studentIds?.length) {
      return errorResponse('COMPETITION_SCHOOL_EXAM_ADMISSION_PAYLOAD_AMBIGUOUS', 400);
    }
    const result = await approveCompetitionSchoolExamAdmissions(env.DB, parsed.data, user.username);
    return jsonResponse(result);
  }

  const progressParts = routeParts(path, /^\/api\/competitions\/([^/]+)\/progress$/);
  if (progressParts && method === 'GET') {
    const [campaignId] = progressParts;
    const url = new URL(request.url);
    const classIds = await getClassIds();
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
}
