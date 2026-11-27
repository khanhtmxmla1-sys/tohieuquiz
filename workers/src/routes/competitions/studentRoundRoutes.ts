import {
  StartCompetitionRoundAttemptRequestSchema,
  SubmitCompetitionRoundAttemptRequestSchema,
} from '../../../../schemas/competition.schema';
import {
  getStudentCompetition,
  getStudentOfficialCompetitionResult,
  listStudentCompetitions,
} from '../../competition/studentCompetitionService';
import { getStudentCompetitionEligibility } from '../../competition/eligibilityService';
import {
  getRoundAttemptQuiz,
  startRoundAttempt,
  submitRoundAttempt,
} from '../../competition/roundService';
import { errorResponse, jsonResponse } from '../../utils/response';
import { jsonBody, routeParts } from './routeSupport';
import type { Env } from '../../types';

export async function handleStudentRoundRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  studentId: string,
): Promise<Response | null> {
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
}
