import { StorageKeys } from '../../constants/storageKeys';
import { defaultCatalog } from './defaultCatalog';
import type { GiftShopMockState } from './types';

const MOCK_STORAGE_KEY = StorageKeys.GIFT_SHOP_MOCK_STATE;

const getDefaultState = (): GiftShopMockState => ({
    catalog: defaultCatalog(),
    orders: [],
    vouchers: [],
    ledger: [],
    walletByStudentId: {},
    idempotencyOrderMap: {},
    events: [],
});

export const readMockState = (): GiftShopMockState => {
    try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY);
        if (!raw) return getDefaultState();
        const parsed = JSON.parse(raw) as Partial<GiftShopMockState>;
        return {
            ...getDefaultState(),
            ...parsed,
            catalog: Array.isArray(parsed.catalog) && parsed.catalog.length > 0
                ? parsed.catalog
                : defaultCatalog(),
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
            ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
            events: Array.isArray(parsed.events) ? parsed.events : [],
            walletByStudentId: parsed.walletByStudentId || {},
            idempotencyOrderMap: parsed.idempotencyOrderMap || {},
        };
    } catch {
        return getDefaultState();
    }
};

export const saveMockState = (state: GiftShopMockState) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
};
