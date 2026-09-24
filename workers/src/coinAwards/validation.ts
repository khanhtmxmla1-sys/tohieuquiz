import {
  COIN_AWARD_MAX_RECIPIENTS,
  COIN_AWARD_TECHNICAL_MAX,
  type CoinAwardCreateInput,
  type CoinAwardErrorCode,
  type CoinAwardSelectionMode,
} from '../../../shared/coin-awards.contract';

export class CoinAwardDomainError extends Error {
  readonly code: CoinAwardErrorCode | string;
  readonly studentIds?: string[];

  constructor(code: CoinAwardErrorCode | string, message = code, studentIds?: string[]) {
    super(message === code || message.startsWith(`${code}:`) ? message : `${code}: ${message}`);
    this.name = 'CoinAwardDomainError';
    this.code = code;
    this.studentIds = studentIds;
  }
}

export const domainError = (
  code: CoinAwardErrorCode | string,
  message = code,
  studentIds?: string[],
): CoinAwardDomainError => new CoinAwardDomainError(code, message, studentIds);

export interface NormalizedCoinAwardInput extends Omit<CoinAwardCreateInput, 'classId' | 'studentIds' | 'reason' | 'idempotencyKey'> {
  classId: string;
  studentIds: string[];
  reason: string;
  idempotencyKey: string;
}

const safeText = (value: unknown, max: number): string => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return text.length <= max ? text : text.slice(0, max + 1);
};

const isSelectionMode = (value: unknown): value is CoinAwardSelectionMode => (
  value === 'STUDENT' || value === 'SELECTED' || value === 'CLASS'
);

export const normalizeIdempotencyKey = (value: unknown): string => {
  const key = safeText(value, 200);
  if (!key || key.length > 200) throw domainError('INVALID_SELECTION', 'Idempotency key is required and must be at most 200 characters');
  return key;
};

export function normalizeCoinAwardInput(input: CoinAwardCreateInput): NormalizedCoinAwardInput {
  if (!input || typeof input !== 'object') throw domainError('INVALID_SELECTION');
  const selectionMode = input.selectionMode;
  if (!isSelectionMode(selectionMode)) throw domainError('INVALID_SELECTION', 'Selection mode is invalid');

  const amount = input.coinsPerStudent;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > COIN_AWARD_TECHNICAL_MAX) {
    throw domainError('INVALID_AMOUNT', 'Coins per student must be a positive integer');
  }

  const rawIds = Array.isArray(input.studentIds) ? input.studentIds : [];
  const studentIds = rawIds.map((value) => String(value ?? '').trim()).filter(Boolean);
  if (new Set(studentIds).size !== studentIds.length) {
    throw domainError('INVALID_SELECTION', 'Duplicate reward recipient');
  }
  if (selectionMode !== 'CLASS' && (studentIds.length < 1 || studentIds.length > COIN_AWARD_MAX_RECIPIENTS)) {
    throw domainError('INVALID_RECIPIENT_COUNT', 'Recipient count is invalid');
  }
  if (selectionMode === 'CLASS' && studentIds.length > COIN_AWARD_MAX_RECIPIENTS) {
    throw domainError('INVALID_RECIPIENT_COUNT', 'Recipient count is invalid');
  }
  if (selectionMode === 'STUDENT' && studentIds.length !== 1) {
    throw domainError('INVALID_RECIPIENT_COUNT', 'A single-student award requires one recipient');
  }

  const reason = safeText(input.reason, 200);
  if (reason.length < 3 || reason.length > 200) throw domainError('INVALID_REASON', 'Reason must contain 3–200 characters');

  return {
    classId: safeText(input.classId, 200),
    studentIds,
    selectionMode,
    coinsPerStudent: amount,
    reason,
    idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
  };
}

export interface NormalizedCoinAwardAdjustmentInput {
  parentBatchId: string;
  studentIds: string[];
  reason: string;
  idempotencyKey: string;
}

export const normalizeAdjustmentInput = (input: {
  parentBatchId: string;
  studentIds: string[];
  reason: string;
  idempotencyKey: string;
}): NormalizedCoinAwardAdjustmentInput => {
  const parentBatchId = safeText(input?.parentBatchId, 200);
  if (!parentBatchId) throw domainError('INVALID_SELECTION', 'Parent batch is required');
  const studentIds = (Array.isArray(input?.studentIds) ? input.studentIds : [])
    .map((value) => String(value ?? '').trim()).filter(Boolean);
  if (studentIds.length < 1 || studentIds.length > COIN_AWARD_MAX_RECIPIENTS) {
    throw domainError('INVALID_RECIPIENT_COUNT');
  }
  if (new Set(studentIds).size !== studentIds.length) throw domainError('INVALID_SELECTION', 'Duplicate reward recipient');
  const reason = safeText(input?.reason, 200);
  if (reason.length < 3 || reason.length > 200) throw domainError('INVALID_REASON');
  return { parentBatchId, studentIds, reason, idempotencyKey: normalizeIdempotencyKey(input?.idempotencyKey) };
};

export const encodeHistoryCursor = (createdAt: string, id: string): string => (
  btoa(JSON.stringify({ createdAt, id }))
);

export const decodeHistoryCursor = (cursor?: string | null): { createdAt: string; id: string } | null => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(atob(cursor)) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw domainError('INVALID_SELECTION', 'History cursor is invalid');
  }
};
