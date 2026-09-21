import { create } from 'zustand';
import type {
  CoinAwardCreateInput,
  CoinAwardHistoryEntry,
  CoinAwardReceipt,
  CoinAwardSettings,
} from '../../../shared/coin-awards.contract';
import * as coinAwardsService from './coinAwardsService';
import type {
  CoinAwardAdjustmentInput,
  CoinAwardHistoryQuery,
  CoinAwardPreview,
  CoinAwardSettingsUpdateInput,
} from './coinAwardsService';

export type CoinAwardsView = 'award' | 'history' | 'settings';

export interface CoinAwardsState {
  view: CoinAwardsView;
  submitting: boolean;
  loadingHistory: boolean;
  loadingSettings: boolean;
  receipt: CoinAwardReceipt | null;
  history: CoinAwardHistoryEntry[];
  nextCursor: string | null;
  settings: CoinAwardSettings | null;
  error: string | null;
  idempotencyKey: string;
  setView(view: CoinAwardsView): void;
  cancelAward(): void;
  submitAward(input: Omit<CoinAwardCreateInput, 'idempotencyKey'>): Promise<CoinAwardReceipt | null>;
  previewAward(input: Omit<CoinAwardCreateInput, 'idempotencyKey'>): Promise<CoinAwardPreview | null>;
  loadHistory(query?: CoinAwardHistoryQuery): Promise<void>;
  loadMoreHistory(): Promise<void>;
  loadMyHistory(query?: CoinAwardHistoryQuery): Promise<void>;
  reverseBatch(batchId: string, reason: string): Promise<CoinAwardReceipt | null>;
  adjustBatch(parentBatchId: string, input: CoinAwardAdjustmentInput): Promise<CoinAwardReceipt | null>;
  loadSettings(): Promise<void>;
  updateSettings(input: CoinAwardSettingsUpdateInput): Promise<CoinAwardSettings | null>;
}

let fallbackKey = 0;

const createIdempotencyKey = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `coin-award-${uuid}`;
  fallbackKey += 1;
  return `coin-award-fallback-${fallbackKey}`;
};

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
};

const dedupeHistory = (items: CoinAwardHistoryEntry[]): CoinAwardHistoryEntry[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.batchId)) return false;
    seen.add(item.batchId);
    return true;
  });
};

const initialState = {
  view: 'award' as CoinAwardsView,
  submitting: false,
  loadingHistory: false,
  loadingSettings: false,
  receipt: null,
  history: [] as CoinAwardHistoryEntry[],
  nextCursor: null,
  settings: null,
  error: null,
  idempotencyKey: createIdempotencyKey(),
};

const mutationBlocked = (state: CoinAwardsState): boolean => state.submitting;

export const useCoinAwardsStore = create<CoinAwardsState>((set, get) => ({
  ...initialState,

  setView: (view) => set({ view }),

  cancelAward: () => {
    if (get().submitting) return;
    set({
      submitting: false,
      receipt: null,
      error: null,
      idempotencyKey: createIdempotencyKey(),
    });
  },

  submitAward: async (input) => {
    if (mutationBlocked(get())) return null;
    const idempotencyKey = get().idempotencyKey;
    set({ submitting: true, error: null, receipt: null });
    try {
      const receipt = await coinAwardsService.createAward({ ...input, idempotencyKey });
      set({ submitting: false, receipt, error: null, idempotencyKey: createIdempotencyKey() });
      return receipt;
    } catch (error) {
      set({ submitting: false, error: messageOf(error) });
      return null;
    }
  },

  previewAward: async (input) => {
    try {
      return await coinAwardsService.previewAward({ ...input, idempotencyKey: get().idempotencyKey });
    } catch (error) {
      set({ error: messageOf(error) });
      return null;
    }
  },

  loadHistory: async (query = {}) => {
    if (get().loadingHistory) return;
    set({ loadingHistory: true, error: null });
    try {
      const page = await coinAwardsService.listAwardHistory(query);
      set({
        history: dedupeHistory(page.items),
        nextCursor: page.nextCursor,
        loadingHistory: false,
        error: null,
      });
    } catch (error) {
      set({ loadingHistory: false, error: messageOf(error) });
    }
  },

  loadMoreHistory: async () => {
    const cursor = get().nextCursor;
    if (!cursor || get().loadingHistory) return;
    set({ loadingHistory: true, error: null });
    try {
      const page = await coinAwardsService.listAwardHistory({ cursor });
      set((state) => ({
        history: dedupeHistory([...state.history, ...page.items]),
        nextCursor: page.nextCursor,
        loadingHistory: false,
        error: null,
      }));
    } catch (error) {
      set({ loadingHistory: false, error: messageOf(error) });
    }
  },

  loadMyHistory: async (query = {}) => {
    if (get().loadingHistory) return;
    set({ loadingHistory: true, error: null });
    try {
      const page = await coinAwardsService.listMyAwardHistory(query);
      set({
        history: dedupeHistory(page.items),
        nextCursor: page.nextCursor,
        loadingHistory: false,
        error: null,
      });
    } catch (error) {
      set({ loadingHistory: false, error: messageOf(error) });
    }
  },

  reverseBatch: async (batchId, reason) => {
    if (mutationBlocked(get())) return null;
    set({ submitting: true, error: null });
    try {
      const receipt = await coinAwardsService.reverseAward(batchId, reason);
      set({ submitting: false, receipt, error: null, idempotencyKey: createIdempotencyKey() });
      return receipt;
    } catch (error) {
      set({ submitting: false, error: messageOf(error) });
      return null;
    }
  },

  adjustBatch: async (parentBatchId, input) => {
    if (mutationBlocked(get())) return null;
    set({ submitting: true, error: null });
    try {
      const receipt = await coinAwardsService.adjustAward(parentBatchId, input);
      set({ submitting: false, receipt, error: null });
      return receipt;
    } catch (error) {
      set({ submitting: false, error: messageOf(error) });
      return null;
    }
  },

  loadSettings: async () => {
    set({ loadingSettings: true, error: null });
    try {
      const settings = await coinAwardsService.getAwardSettings();
      set({ loadingSettings: false, settings, error: null });
    } catch (error) {
      set({ loadingSettings: false, error: messageOf(error) });
    }
  },

  updateSettings: async (input) => {
    if (mutationBlocked(get())) return null;
    set({ submitting: true, error: null });
    try {
      const settings = await coinAwardsService.updateAwardSettings(input);
      set({ submitting: false, settings, error: null });
      return settings;
    } catch (error) {
      set({ submitting: false, error: messageOf(error) });
      return null;
    }
  },
}));
