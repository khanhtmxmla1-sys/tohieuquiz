import {
  isCertificateNameFont,
  type CreateCertificateBatchRequest,
} from '../../../../shared/certificates.contract';
import { certificateError } from './responses';
import type { BatchInput } from './batchTypes';

export async function parseBatchRequest(request: Request): Promise<Response | BatchInput> {
  let body: CreateCertificateBatchRequest;
  try {
    const parsed = await request.json<unknown>();
    if (!parsed || typeof parsed !== 'object') {
      return certificateError('CERTIFICATE_INVALID_JSON', 'Request body must be a JSON object');
    }
    body = parsed as CreateCertificateBatchRequest;
  } catch {
    return certificateError('CERTIFICATE_INVALID_JSON', 'Request body must be valid JSON');
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
  const classId = typeof body.class_id === 'string' ? body.class_id.trim() : '';
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  const quizId = typeof body.quiz_id === 'string' && body.quiz_id.trim() ? body.quiz_id.trim() : null;
  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
  const achievementPrefix = typeof body.achievement_prefix === 'string'
    ? body.achievement_prefix.trim()
    : null;
  const dateLine = typeof body.date_line === 'string' ? body.date_line.trim() : null;
  const studentNameFontValue = typeof body.student_name_font === 'string'
    ? body.student_name_font.trim()
    : '';
  const studentNameFont = studentNameFontValue && isCertificateNameFont(studentNameFontValue)
    ? studentNameFontValue
    : null;
  const validStudentIds = Array.isArray(body.student_ids)
    && body.student_ids.every((studentId) => typeof studentId === 'string');
  const studentIds = validStudentIds
    ? Array.from(new Set(body.student_ids.map((studentId) => studentId.trim()).filter(Boolean)))
    : [];
  if (!requestId || !title || !classId || !templateId || studentIds.length === 0) {
    return certificateError(
      'CERTIFICATE_VALIDATION_ERROR',
      'request_id, title, class_id, template_id and at least one student_id are required',
    );
  }
  if (studentIds.length > 100) {
    return certificateError('CERTIFICATE_BATCH_TOO_LARGE', 'A batch can contain at most 100 students');
  }
  if (studentNameFontValue && !studentNameFont) {
    return certificateError('CERTIFICATE_VALIDATION_ERROR', 'Unsupported student-name font');
  }
  if (
    requestId.length > 128
    || title.length > 200
    || (message?.length ?? 0) > 500
    || (achievementPrefix?.length ?? 0) > 160
    || (dateLine?.length ?? 0) > 200
  ) {
    return certificateError('CERTIFICATE_VALIDATION_ERROR', 'One or more fields exceed the allowed length');
  }
  return {
    title, requestId, classId, templateId, quizId, message,
    achievementPrefix, dateLine, studentNameFont, studentIds,
  };
}
