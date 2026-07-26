import type { ResultReportBatchDetail, ResultReportBatchStatus } from '../../../../shared/result-reports.contract';
import { requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import {
  getOwnedResultReportBatch,
  loadResultReportBatchDetail,
  type ResultReportBatchRecord,
} from './batchRepository';
import { parseResultReportRetryRequest } from './batchRequest';
import { createResultReportDeliveryRuntime, processResultReportBatch } from './deliveryItemService';
import { resultReportError, resultReportSuccess } from './responses';

export interface ResultReportRetryDependencies {
  getOwnedBatch(batchId: string): Promise<ResultReportBatchRecord | null>;
  processBatch(batchId: string, itemIds?: string[]): Promise<ResultReportBatchStatus>;
  getBatchDetail(batch: ResultReportBatchRecord): Promise<ResultReportBatchDetail>;
}

export async function handleRetryResultReportBatch(
  request: Request,
  env: Env,
  batchId: string,
  injected?: ResultReportRetryDependencies,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return resultReportError('RESULT_REPORT_FORBIDDEN', 'Teacher access required', 403);
  }
  const itemIds = await parseResultReportRetryRequest(request);
  if (itemIds instanceof Response) return itemIds;
  const deps = injected || {
    getOwnedBatch: (id: string) => getOwnedResultReportBatch(
      env.DB, id, authResult.user.username, authResult.user.role === 'admin',
    ),
    processBatch: (id: string, ids?: string[]) => processResultReportBatch(
      id, createResultReportDeliveryRuntime(env, authResult.user), ids,
    ),
    getBatchDetail: (batch: ResultReportBatchRecord) => loadResultReportBatchDetail(env.DB, batch),
  };
  const batch = await deps.getOwnedBatch(batchId);
  if (!batch) {
    return resultReportError('RESULT_REPORT_BATCH_NOT_FOUND', 'Result report batch not found', 404);
  }
  await deps.processBatch(batchId, itemIds);
  const refreshed = await deps.getOwnedBatch(batchId) || batch;
  return resultReportSuccess(await deps.getBatchDetail(refreshed));
}
