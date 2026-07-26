import { errorResponse } from '../../utils/response';
import type { Env } from '../../types';
import { canAccessTeacherScope } from './auth';
import { handleGetPhieuBySubmission } from './phieuMutationService';
import { getSubmissionScope } from './scopeRepository';
import type { PhieuScopeUser } from './types';

export async function handleSubmissionGetRoute(
  env: Env,
  submissionId: string,
  user: PhieuScopeUser,
): Promise<Response> {
  const decodedId = decodeURIComponent(submissionId);
  const scope = await getSubmissionScope(env.DB, decodedId);
  if (!scope) return errorResponse('Submission not found', 404);
  if (!canAccessTeacherScope(user, scope.teacher_username)) {
    return errorResponse('Forbidden', 403);
  }
  return handleGetPhieuBySubmission(env.DB, { submissionId: decodedId });
}
