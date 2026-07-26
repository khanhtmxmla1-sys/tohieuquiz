import { errorResponse } from '../../utils/response';
import { internalErrorResponse } from '../../utils/internalError';
import * as LiveExamService from '../../services/liveExamService';

export function liveExamErrorResponse(
  error: unknown,
  request: Request,
  fallback: string,
  defaultStatus = 500,
): Response {
  if (error instanceof LiveExamService.LiveExamServiceError && error.status < 500) {
    return errorResponse(error.message, error.status);
  }
  if (defaultStatus < 500) return errorResponse(fallback, defaultStatus);
  return internalErrorResponse(error, request, {
    context: `live-exam ${new URL(request.url).pathname}`,
    clientMessage: fallback,
  });
}

export function calculateTimeRemaining(endsAt: string): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}
