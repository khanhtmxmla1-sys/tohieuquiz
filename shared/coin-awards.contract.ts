export const COIN_AWARD_PRESETS = [5, 10, 20, 50] as const;
export const COIN_AWARD_MAX_RECIPIENTS = 100;
export const COIN_AWARD_TECHNICAL_MAX = 1_000_000;

export type CoinAwardSelectionMode = 'STUDENT' | 'SELECTED' | 'CLASS';
export type CoinAwardBatchKind = 'AWARD' | 'REVERSAL' | 'ADJUSTMENT';

export type CoinAwardErrorCode =
  | 'FEATURE_DISABLED'
  | 'INVALID_AMOUNT'
  | 'INVALID_REASON'
  | 'INVALID_RECIPIENT_COUNT'
  | 'INVALID_SELECTION'
  | 'UNAUTHORIZED_RECIPIENT'
  | 'INACTIVE_RECIPIENT'
  | 'LIMIT_EXCEEDED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REVERSAL_EXPIRED'
  | 'ALREADY_REVERSED'
  | 'INSUFFICIENT_BALANCE';

export interface CoinAwardCreateInput {
  classId: string;
  studentIds: string[];
  selectionMode: CoinAwardSelectionMode;
  coinsPerStudent: number;
  reason: string;
  idempotencyKey: string;
}

export interface CoinAwardReceipt {
  batchId: string;
  kind: CoinAwardBatchKind;
  recipientCount: number;
  coinsPerStudent: number;
  totalCoins: number;
  reason: string;
  actorUsername: string;
  actorDisplayName: string;
  actorRole: 'teacher' | 'admin';
  classId: string | null;
  className: string | null;
  createdAt: string;
  reversalExpiresAt: string | null;
  alreadyProcessed: boolean;
}

export interface CoinAwardHistoryEntry extends CoinAwardReceipt {
  parentBatchId: string | null;
  hanoiDate: string;
}

export interface CoinAwardHistoryPage {
  items: CoinAwardHistoryEntry[];
  nextCursor: string | null;
}

export interface CoinAwardSettings {
  scopeKey: 'school';
  maxCoinsPerStudent: number;
  maxTeacherDailyCoins: number;
  reversalWindowMinutes: number;
  updatedBy: string;
  updatedAt: string;
}

export interface CoinAwardError {
  code: CoinAwardErrorCode;
  message: string;
  studentIds?: string[];
}
