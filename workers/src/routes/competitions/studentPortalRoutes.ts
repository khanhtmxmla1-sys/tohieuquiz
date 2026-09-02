import {
  preflightStudentCompetitionRound,
  preflightStudentCompetitionSchoolExam,
  resolveStudentCompetitionBySlug,
  STUDENT_COMPETITION_PORTAL_NOT_FOUND,
  STUDENT_COMPETITION_PORTAL_UNAVAILABLE,
} from '../../competition/studentPortalService';
import {
  COMPETITION_PORTAL_FEATURE_DISABLED,
  isCompetitionStudentPortalEnabled,
} from '../../competition/portalFeatureFlags';
import { errorResponse, jsonResponse } from '../../utils/response';

function decodedSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded && !decoded.includes('/') ? decoded : null;
  } catch {
    return null;
  }
}

export async function handleStudentCompetitionPortalRoutes(
  db: D1Database,
  path: string,
  method: string,
  studentId: string,
  studentUsername = studentId,
): Promise<Response | null> {
  const schoolExamPreflightMatch = path.match(
    /^\/api\/student\/competitions\/([^/]+)\/school-exam\/preflight$/,
  );
  const preflightMatch = path.match(
    /^\/api\/student\/competitions\/([^/]+)\/rounds\/([^/]+)\/preflight$/,
  );
  const match = path.match(/^\/api\/student\/competitions\/by-slug\/([^/]+)$/);
  if (!schoolExamPreflightMatch && !preflightMatch && !match) return null;
  if (!await isCompetitionStudentPortalEnabled(db, studentUsername)) {
    return errorResponse(COMPETITION_PORTAL_FEATURE_DISABLED, 503);
  }

  if (schoolExamPreflightMatch) {
    if (method !== 'POST') return errorResponse('Method not allowed', 405);
    const campaignId = decodedSegment(schoolExamPreflightMatch[1]);
    if (!campaignId) return errorResponse('Invalid competition', 400);
    const preflight = await preflightStudentCompetitionSchoolExam(db, campaignId, studentId);
    return jsonResponse({ preflight });
  }

  if (preflightMatch) {
    if (method !== 'POST') return errorResponse('Method not allowed', 405);
    const campaignId = decodedSegment(preflightMatch[1]);
    const roundId = decodedSegment(preflightMatch[2]);
    if (!campaignId || !roundId) return errorResponse('Invalid competition round', 400);
    const preflight = await preflightStudentCompetitionRound(db, campaignId, roundId, studentId);
    return jsonResponse({ preflight });
  }

  if (method !== 'GET') return errorResponse('Method not allowed', 405);

  const campaignSlug = decodedSegment(match![1]);
  if (!campaignSlug) return errorResponse(STUDENT_COMPETITION_PORTAL_NOT_FOUND, 404);

  try {
    const resolution = await resolveStudentCompetitionBySlug(db, campaignSlug, studentId);
    return jsonResponse(resolution);
  } catch (error) {
    if (error instanceof Error && error.message === STUDENT_COMPETITION_PORTAL_NOT_FOUND) {
      return errorResponse(STUDENT_COMPETITION_PORTAL_NOT_FOUND, 404);
    }
    return errorResponse(STUDENT_COMPETITION_PORTAL_UNAVAILABLE, 503);
  }
}
