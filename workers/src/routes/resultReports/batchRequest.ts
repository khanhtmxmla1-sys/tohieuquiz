import {
  isResultReportAttemptPolicy,
  type CreateResultReportBatchRequest,
  type ResultReportDraftInput,
  type ResultReportRetryRequest,
  type ResultReportRevokeRequest,
} from '../../../../shared/result-reports.contract';
import { resultReportError } from './responses';

export interface ParsedResultReportBatchRequest extends CreateResultReportBatchRequest {
  expiresInDays: number;
}

const STYLES = new Set(['nhe_nhang', 'nghiem_tuc', 'vui_ve']);
const MODES = new Set(['ai', 'manual']);
const isId = (value: unknown, min = 1, max = 128): value is string => (
  typeof value === 'string'
  && value.trim().length >= min
  && value.trim().length <= max
);
const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
};

function parseDraft(value: unknown): ResultReportDraftInput | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Record<string, unknown>;
  const comment = cleanText(draft.comment, 4000);
  const needsImprovement = cleanText(draft.needsImprovement, 4000);
  const encouragement = cleanText(draft.encouragement, 4000);
  if (!isId(draft.resultId)
    || typeof draft.style !== 'string'
    || !STYLES.has(draft.style)
    || (draft.commentMode !== undefined
      && (typeof draft.commentMode !== 'string' || !MODES.has(draft.commentMode)))
    || comment === null
    || needsImprovement === null
    || encouragement === null) {
    return null;
  }
  return {
    resultId: draft.resultId.trim(),
    style: draft.style as ResultReportDraftInput['style'],
    commentMode: draft.commentMode === 'ai' ? 'ai' : 'manual',
    comment,
    needsImprovement,
    encouragement,
  };
}

export async function parseCreateResultReportBatchRequest(
  request: Request,
): Promise<ParsedResultReportBatchRequest | Response> {
  let body: Partial<CreateResultReportBatchRequest> | null = null;
  try {
    body = await request.json<Partial<CreateResultReportBatchRequest>>();
  } catch {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object'
    || !isId(body.requestId, 8, 128)
    || !isId(body.classId)
    || !isId(body.quizId)
    || !isResultReportAttemptPolicy(body.attemptPolicy)
    || !Array.isArray(body.drafts)
    || body.drafts.length < 1
    || body.drafts.length > 200
    || typeof body.notifyStudents !== 'boolean'
    || typeof body.createParentLinks !== 'boolean') {
    return resultReportError(
      'RESULT_REPORT_VALIDATION_ERROR',
      'Invalid result report batch request',
      400,
    );
  }
  const drafts = body.drafts.map(parseDraft);
  if (drafts.some((draft) => !draft)) {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Invalid result report draft', 400);
  }
  const typedDrafts = drafts as ResultReportDraftInput[];
  if (new Set(typedDrafts.map((draft) => draft.resultId)).size !== typedDrafts.length) {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Duplicate resultId', 400);
  }
  const rawDays = body.expiresInDays === undefined ? 30 : Number(body.expiresInDays);
  if (!Number.isInteger(rawDays) || rawDays < 1 || rawDays > 365) {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'expiresInDays must be 1-365', 400);
  }
  return {
    requestId: body.requestId.trim(),
    classId: body.classId.trim(),
    quizId: body.quizId.trim(),
    attemptPolicy: body.attemptPolicy,
    drafts: typedDrafts,
    notifyStudents: body.notifyStudents,
    createParentLinks: body.createParentLinks,
    expiresInDays: rawDays,
  };
}

async function parseItemIdsRequest(
  request: Request,
): Promise<string[] | undefined | Response> {
  let body: ResultReportRetryRequest | ResultReportRevokeRequest | null = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object') {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Invalid request', 400);
  }
  if (body.itemIds === undefined) return undefined;
  if (!Array.isArray(body.itemIds)
    || body.itemIds.length > 200
    || body.itemIds.some((id) => !isId(id))) {
    return resultReportError('RESULT_REPORT_VALIDATION_ERROR', 'Invalid itemIds', 400);
  }
  return Array.from(new Set(body.itemIds.map((id) => id.trim())));
}

export const parseResultReportRetryRequest = parseItemIdsRequest;
export const parseResultReportRevokeRequest = parseItemIdsRequest;
