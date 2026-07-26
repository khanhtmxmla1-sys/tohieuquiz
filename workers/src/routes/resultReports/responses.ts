import type {
  ResultReportApiError,
  ResultReportApiSuccess,
} from '../../../../shared/result-reports.contract';

export function resultReportSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data } satisfies ResultReportApiSuccess<T>), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function resultReportError(
  code: string,
  message: string,
  status = 400,
): Response {
  return new Response(JSON.stringify({ error: { code, message } } satisfies ResultReportApiError), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
