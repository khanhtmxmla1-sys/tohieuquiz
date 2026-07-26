import type { RouteRegistry } from '../types';

const stripPathField = (field: string) => (_action: string, payload: Record<string, any>) => {
  const { [field]: _pathValue, ...body } = payload;
  return body;
};

export const resultReportRoutes: RouteRegistry = {
  get_result_report_cohort: {
    method: 'POST',
    auth: 'session',
    path: () => '/api/result-reports/cohort',
  },
  create_result_report_batch: {
    method: 'POST',
    auth: 'session',
    path: () => '/api/result-reports/batches',
  },
  get_result_report_batch: {
    method: 'GET',
    auth: 'session',
    path: ({ batchId }) => `/api/result-reports/batches/${encodeURIComponent(String(batchId || ''))}`,
  },
  retry_result_report_batch: {
    method: 'POST',
    auth: 'session',
    path: ({ batchId }) => `/api/result-reports/batches/${encodeURIComponent(String(batchId || ''))}/retry`,
    body: stripPathField('batchId'),
  },
  revoke_result_report_links: {
    method: 'POST',
    auth: 'session',
    path: ({ batchId }) => `/api/result-reports/batches/${encodeURIComponent(String(batchId || ''))}/revoke`,
    body: stripPathField('batchId'),
  },
  get_my_result_reports: {
    method: 'GET',
    auth: 'studentSession',
    path: () => '/api/result-reports/mine',
  },
  get_my_result_report: {
    method: 'GET',
    auth: 'studentSession',
    path: ({ phieuId }) => `/api/result-reports/mine/${encodeURIComponent(String(phieuId || ''))}`,
  },
};
