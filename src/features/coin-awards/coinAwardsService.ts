import type {
  CoinAwardCreateInput,
  CoinAwardHistoryPage,
  CoinAwardReceipt,
  CoinAwardSettings,
} from '../../../shared/coin-awards.contract';
import { callApi } from '../../services/apiAdapter';

export interface CoinAwardPreview {
  classId: string | null;
  className: string | null;
  studentIds: string[];
  recipientCount: number;
  coinsPerStudent: number;
  totalCoins: number;
  reason: string;
  remainingTeacherDailyCoins: number | null;
}

export interface CoinAwardHistoryQuery {
  cursor?: string;
  limit?: number;
}

export interface CoinAwardAdjustmentInput {
  studentIds: string[];
  reason: string;
  idempotencyKey: string;
}

export interface CoinAwardSettingsUpdateInput {
  maxCoinsPerStudent: number;
  maxTeacherDailyCoins: number;
  reversalWindowMinutes: number;
  expectedUpdatedAt: string;
  reason: string;
}

interface ApiEnvelope<T> {
  status?: string;
  data?: T;
}

const unwrap = <T>(response: ApiEnvelope<T> | T): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as ApiEnvelope<T>).data;
    if (data !== undefined) return data;
  }
  return response as T;
};

export async function previewAward(input: CoinAwardCreateInput): Promise<CoinAwardPreview> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardPreview>>('preview_coin_award', input));
}

export async function createAward(input: CoinAwardCreateInput): Promise<CoinAwardReceipt> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardReceipt>>('create_coin_award', input));
}

export async function listAwardHistory(query: CoinAwardHistoryQuery = {}): Promise<CoinAwardHistoryPage> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardHistoryPage>>('list_coin_award_history', query));
}

export async function reverseAward(batchId: string, reason: string): Promise<CoinAwardReceipt> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardReceipt>>('reverse_coin_award', { batchId, reason }));
}

export async function adjustAward(
  parentBatchId: string,
  input: CoinAwardAdjustmentInput,
): Promise<CoinAwardReceipt> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardReceipt>>('adjust_coin_award', { parentBatchId, ...input }));
}

export async function getAwardSettings(): Promise<CoinAwardSettings> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardSettings>>('get_coin_award_settings'));
}

export async function updateAwardSettings(input: CoinAwardSettingsUpdateInput): Promise<CoinAwardSettings> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardSettings>>('update_coin_award_settings', input));
}

export async function listMyAwardHistory(query: CoinAwardHistoryQuery = {}): Promise<CoinAwardHistoryPage> {
  return unwrap(await callApi<ApiEnvelope<CoinAwardHistoryPage>>('list_my_coin_award_history', query));
}
