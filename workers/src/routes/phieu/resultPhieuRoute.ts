import { errorResponse, jsonResponse } from '../../utils/response';
import { parseBody } from '../../utils/helpers';
import type { Env } from '../../types';
import { canAccessTeacherScope } from './auth';
import { getXepLoai, mapPhieu } from './phieuMapper';
import {
  getActivePublicLinkByPhieuId,
  getResultPhieuRecord,
  resultSubmissionKey,
} from './phieuRepository';
import { getResultScope } from './scopeRepository';
import { handleUpsertPhieu } from './phieuMutationService';
import type { PhieuScopeUser } from './types';

export async function handleResultPhieuRoute(
  request: Request,
  env: Env,
  resultId: string,
  method: string,
  user: PhieuScopeUser,
): Promise<Response> {
  const decodedResultId = decodeURIComponent(resultId).trim();
  if (!decodedResultId) return errorResponse('Missing result id');
  const scope = await getResultScope(env.DB, decodedResultId, user);
  if (!scope) return errorResponse('Result not found or class is inactive', 404);
  if (!canAccessTeacherScope(user, scope.teacher_username)) {
    return errorResponse('Forbidden', 403);
  }

  const existing = await getResultPhieuRecord(env.DB, decodedResultId);
  if (method === 'GET') {
    const link = existing
      ? await getActivePublicLinkByPhieuId(env.DB, existing.id)
      : null;
    return jsonResponse({
      status: 'success',
      data: { phieu: existing ? mapPhieu(existing) : null, link },
    });
  }
  if (method !== 'POST') return errorResponse('Method not allowed', 405);

  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid JSON body');
  const data = body.data || body;
  const score = Number(scope.diem_so) || 0;
  return handleUpsertPhieu(env.DB, {
    ...data,
    id: existing?.id,
    submission_id: existing?.submission_id || resultSubmissionKey(decodedResultId),
    student_id: scope.student_id,
    student_name: scope.student_name,
    class_id: scope.class_id,
    mon_hoc: scope.mon_hoc,
    ten_bai_tap: scope.ten_bai_tap,
    ngay_lam_bai: scope.ngay_lam_bai,
    tong_cau: Number(scope.tong_cau) || 0,
    so_cau_dung: Number(scope.so_cau_dung) || 0,
    so_cau_sai: Number(scope.so_cau_sai) || 0,
    diem_so: score,
    xep_loai: getXepLoai(score),
    created_by: user.username,
  }, env.OG_IMAGES);
}
