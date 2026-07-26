import { errorResponse } from '../../utils/response';
import { parseBody } from '../../utils/helpers';
import type { Env } from '../../types';
import { canAccessTeacherScope } from './auth';
import { handleUpsertPhieu } from './phieuMutationService';
import { getSubmissionScope } from './scopeRepository';
import type { PhieuScopeUser } from './types';

export async function handleSubmissionUpsertRoute(
  request: Request,
  env: Env,
  user: PhieuScopeUser,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid JSON body');
  const data = body.data || body;
  const submissionId = String(data.submission_id || data.submissionId || '').trim();
  if (!submissionId) return errorResponse('Missing submission_id');
  const scope = await getSubmissionScope(env.DB, submissionId);
  if (!scope) return errorResponse('Submission not found', 404);
  if (!canAccessTeacherScope(user, scope.teacher_username)) {
    return errorResponse('Forbidden', 403);
  }
  return handleUpsertPhieu(env.DB, {
    ...data,
    submission_id: scope.submission_id,
    student_id: scope.student_id,
    student_name: scope.student_name,
    class_id: scope.class_id,
    created_by: user.username,
  }, env.OG_IMAGES);
}
