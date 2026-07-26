import { jsonResponse } from '../../utils/response';
import type {
  CertificateApiError,
  CertificateApiSuccess,
} from '../../../../shared/certificates.contract';

export function certificateError(code: string, message: string, status = 400): Response {
  return jsonResponse<CertificateApiError>({ error: { code, message } }, status);
}

export function certificateSuccess<T>(data: T, status = 200): Response {
  return jsonResponse<CertificateApiSuccess<T>>({ data }, status);
}
