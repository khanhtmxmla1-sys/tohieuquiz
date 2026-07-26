import type { ResultReportBatchDetail } from '../../../../shared/result-reports.contract';
import { requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import {
  getOwnedResultReportBatch,
  loadResultReportBatchDetail,
  revokeResultReportLinks,
  type ResultReportBatchRecord,
} from './batchRepository';
import { parseResultReportRevokeRequest } from './batchRequest';
import { resultReportError, resultReportSuccess } from './responses';

export interface ResultReportRevokeDependencies {
  getOwnedBatch(batchId: string): Promise<ResultReportBatchRecord | null>;
  revokeLinks(batchId: string, itemIds?: string[]): Promise<number>;
  getBatchDetail(batch: ResultReportBatchRecord): Promise<ResultReportBatchDetail>;
}

export async function handleRevokeResultReportLinks(
  request: Request,
  env: Env,
  batchId: string,
  injected?: ResultReportRevokeDependencies,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return resultReportError('RESULT_REPORT_FORBIDDEN', 'Teacher access required', 403);
  }
  const itemIds = await parseResultReportRevokeRequest(request);
  if (itemIds instanceof Response) return itemIds;
  const deps = injected || {
    getOwnedBatch: (id: string) => getOwnedResultReportBatch(
      env.DB, id, authResult.user.username, authResult.user.role === 'admin',
    ),
    revokeLinks: (id: string, ids?: string[]) => revokeResultReportLinks(env.DB, id, ids),
    getBatchDetail: (batch: ResultReportBatchRecord) => loadResultReportBatchDetail(env.DB, batch),
  };
  const batch = await deps.getOwnedBatch(batchId);
  if (!batch) {
    return resultReportError('RESULT_REPORT_BATCH_NOT_FOUND', 'Result report batch not found', 404);
  }
  await deps.revokeLinks(batchId, itemIds);
  return resultReportSuccess(await deps.getBatchDetail(batch));
}
