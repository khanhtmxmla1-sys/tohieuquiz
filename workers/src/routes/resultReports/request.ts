import {
  isResultReportAttemptPolicy,
  type ResultReportCohortRequest,
} from '../../../../shared/result-reports.contract';
import type { ResultReportCohortInput } from './types';
import { resultReportError } from './responses';

const isScopeId = (value: unknown): value is string => (
  typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= 128
);

export async function parseResultReportCohortRequest(
  request: Request,
): Promise<ResultReportCohortInput | Response> {
  let body: Partial<ResultReportCohortRequest> | null = null;
  try {
    body = await request.json<Partial<ResultReportCohortRequest>>();
  } catch {
    return resultReportError(
      'RESULT_REPORT_VALIDATION_ERROR',
      'Invalid JSON body',
      400,
    );
  }

  if (!body || typeof body !== 'object'
    || !isScopeId(body.classId)
    || !isScopeId(body.quizId)
    || !isResultReportAttemptPolicy(body.attemptPolicy)) {
    return resultReportError(
      'RESULT_REPORT_VALIDATION_ERROR',
      'classId, quizId, and a valid attemptPolicy are required',
      400,
    );
  }

  return {
    classId: body.classId.trim(),
    quizId: body.quizId.trim(),
    attemptPolicy: body.attemptPolicy,
  };
}
