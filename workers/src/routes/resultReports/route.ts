import type { Env } from '../../types';
import { handleResultReportCohort } from './cohortHandler';
import { handleCreateResultReportBatch } from './batchHandler';
import { handleGetResultReportBatchDetail } from './batchDetailHandler';
import { handleRetryResultReportBatch } from './retryHandler';
import { handleRevokeResultReportLinks } from './revokeHandler';
import {
  handleGetMyResultReport,
  handleListMyResultReports,
} from './studentReportsHandler';
import { resultReportError } from './responses';

export async function handleResultReportRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  if (path === '/api/result-reports/cohort') {
    if (method !== 'POST') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleResultReportCohort(request, env);
  }

  if (path === '/api/result-reports/batches') {
    if (method !== 'POST') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleCreateResultReportBatch(request, env);
  }

  if (path === '/api/result-reports/mine') {
    if (method !== 'GET') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleListMyResultReports(request, env);
  }

  const mineMatch = path.match(/^\/api\/result-reports\/mine\/([^/]+)$/);
  if (mineMatch) {
    if (method !== 'GET') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleGetMyResultReport(request, env, decodeURIComponent(mineMatch[1]));
  }

  const retryMatch = path.match(/^\/api\/result-reports\/batches\/([^/]+)\/retry$/);
  if (retryMatch) {
    if (method !== 'POST') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleRetryResultReportBatch(request, env, decodeURIComponent(retryMatch[1]));
  }

  const revokeMatch = path.match(/^\/api\/result-reports\/batches\/([^/]+)\/revoke$/);
  if (revokeMatch) {
    if (method !== 'POST') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleRevokeResultReportLinks(request, env, decodeURIComponent(revokeMatch[1]));
  }

  const batchMatch = path.match(/^\/api\/result-reports\/batches\/([^/]+)$/);
  if (batchMatch) {
    if (method !== 'GET') {
      return resultReportError('RESULT_REPORT_METHOD_NOT_ALLOWED', 'Method not allowed', 405);
    }
    return handleGetResultReportBatchDetail(request, env, decodeURIComponent(batchMatch[1]));
  }

  return resultReportError('RESULT_REPORT_NOT_FOUND', 'Not found', 404);
}
