import { errorResponse, jsonResponse } from '../../utils/response';
import { mapPhieu } from './phieuMapper';
import { getPhieuBySubmission } from './phieuRepository';

export { handleUpsertPhieu } from './phieuUpsertService';
export { handlePublishPhieuBatch } from './phieuPublishService';

export async function handleGetPhieuBySubmission(
  db: D1Database,
  body: any,
): Promise<Response> {
  const submissionId = body.submissionId || body.submission_id || body.data?.submissionId;
  if (!submissionId) return errorResponse('Missing submissionId');
  const row = await getPhieuBySubmission(db, submissionId);
  return jsonResponse({ status: 'success', data: row ? mapPhieu(row) : null });
}

export async function handleDeactivatePublicPhieuLink(
  db: D1Database,
  body: any,
): Promise<Response> {
  const publicToken = body.publicToken || body.public_token || body.data?.publicToken;
  if (!publicToken) return errorResponse('Missing publicToken');
  await db.prepare('UPDATE phieu_public_links SET is_active = 0 WHERE public_token = ?')
    .bind(publicToken)
    .run();
  return jsonResponse({ status: 'success' });
}
