import {
  resolveStudentCompetitionBySlug,
  STUDENT_COMPETITION_PORTAL_NOT_FOUND,
  STUDENT_COMPETITION_PORTAL_UNAVAILABLE,
} from '../../competition/studentPortalService';
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
): Promise<Response | null> {
  const match = path.match(/^\/api\/student\/competitions\/by-slug\/([^/]+)$/);
  if (!match) return null;
  if (method !== 'GET') return errorResponse('Method not allowed', 405);

  const campaignSlug = decodedSegment(match[1]);
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
