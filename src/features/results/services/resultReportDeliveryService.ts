import type {
  CreateResultReportBatchRequest,
  CreateResultReportBatchResult,
  ResultReportApiSuccess,
  ResultReportBatchDetail,
  ResultReportCohortRequest,
  ResultReportCohortResponse,
  StudentResultReportDetail,
  StudentResultReportSummary,
} from '../../../../shared/result-reports.contract';
import { callApi } from '../../../services/apiAdapter';

export class ResultReportDeliveryError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'RESULT_REPORT_REQUEST_FAILED', status?: number) {
    super(message);
    this.name = 'ResultReportDeliveryError';
    this.code = code;
    this.status = status;
  }
}

export const normalizeResultReportDeliveryError = (error: unknown): ResultReportDeliveryError => {
  if (error instanceof ResultReportDeliveryError) return error;
  const source = error as { message?: unknown; code?: unknown; status?: unknown };
  return new ResultReportDeliveryError(
    typeof source?.message === 'string' ? source.message : 'Không thể xử lý phiếu kết quả.',
    typeof source?.code === 'string' ? source.code : 'RESULT_REPORT_REQUEST_FAILED',
    typeof source?.status === 'number' ? source.status : undefined,
  );
};

const request = async <T>(action: string, payload: object = {}): Promise<T> => {
  try {
    const response = await callApi<ResultReportApiSuccess<T>>(
      action,
      payload as Record<string, unknown>,
    );
    if (!response || !Object.prototype.hasOwnProperty.call(response, 'data')) {
      throw new ResultReportDeliveryError(
        'Phản hồi phiếu kết quả không hợp lệ.',
        'RESULT_REPORT_INVALID_RESPONSE',
      );
    }
    return response.data;
  } catch (error: unknown) {
    throw normalizeResultReportDeliveryError(error);
  }
};

export const resultReportDeliveryService = {
  getCohort: (input: ResultReportCohortRequest) => (
    request<ResultReportCohortResponse>('get_result_report_cohort', input)
  ),
  createBatch: (input: CreateResultReportBatchRequest) => (
    request<CreateResultReportBatchResult>('create_result_report_batch', input)
  ),
  getBatch: (batchId: string) => (
    request<ResultReportBatchDetail>('get_result_report_batch', { batchId })
  ),
  retryBatch: (batchId: string, itemIds?: string[]) => (
    request<ResultReportBatchDetail>('retry_result_report_batch', { batchId, itemIds })
  ),
  revokeLinks: (batchId: string, itemIds?: string[]) => (
    request<ResultReportBatchDetail>('revoke_result_report_links', { batchId, itemIds })
  ),
  listMine: () => request<StudentResultReportSummary[]>('get_my_result_reports'),
  getMine: (phieuId: string) => (
    request<StudentResultReportDetail>('get_my_result_report', { phieuId })
  ),
};
