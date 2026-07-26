import type { GiftShopEventLog, WalletLedgerEntry } from '../../types/giftShop.types';
import type { GiftShopMockState } from './types';

const EVENT_LIMIT = 500;
const LEDGER_LIMIT = 1000;

export const nowIso = () => new Date().toISOString();

export const randomId = (prefix: string) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const pushEvent = (
    state: GiftShopMockState,
    event: Omit<GiftShopEventLog, 'id' | 'createdAt'>
) => {
    state.events.unshift({ id: randomId('ev'), createdAt: nowIso(), ...event });
    if (state.events.length > EVENT_LIMIT) {
        state.events = state.events.slice(0, EVENT_LIMIT);
    }
};

export const pushLedger = (
    state: GiftShopMockState,
    entry: Omit<WalletLedgerEntry, 'id' | 'createdAt'>
) => {
    state.ledger.unshift({ id: randomId('ledger'), createdAt: nowIso(), ...entry });
    if (state.ledger.length > LEDGER_LIMIT) {
        state.ledger = state.ledger.slice(0, LEDGER_LIMIT);
    }
};

export const ensureWallet = (
    state: GiftShopMockState,
    studentId: string,
    currentCoins: number
) => {
    const existing = state.walletByStudentId[studentId];
    if (typeof existing === 'number') return existing;
    state.walletByStudentId[studentId] = Math.max(0, Number(currentCoins) || 0);
    return state.walletByStudentId[studentId];
};
