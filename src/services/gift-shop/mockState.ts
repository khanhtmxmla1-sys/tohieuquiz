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
    settings: {
        effective: { isOpen: true, closedReason: '', closedScope: null, schoolId: '', classId: '' },
        settings: [],
    },
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
                ? parsed.catalog.map((item) => ({
                    ...item,
                    stockTotal: Number(item.stockTotal ?? 100),
                    stockRemaining: Number(item.stockRemaining ?? item.stockTotal ?? 100),
                    lowStockThreshold: Number(item.lowStockThreshold ?? 5),
                    weeklyLimitPerStudent: Number(item.weeklyLimitPerStudent ?? 1),
                    scopeType: item.scopeType || 'SCHOOL',
                    schoolId: item.schoolId || '',
                }))
                : defaultCatalog(),
            orders: Array.isArray(parsed.orders) ? parsed.orders.map((order) => ({
                ...order,
                status: String(order.status) === 'VOUCHER_ISSUED'
                    ? 'APPROVED'
                    : String(order.status) === 'CANCELLED_REFUNDED'
                        ? 'CANCELLED'
                        : String(order.status) === 'CREATED' ? 'PENDING' : order.status,
            })) : [],
            vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
            ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
            events: Array.isArray(parsed.events) ? parsed.events : [],
            walletByStudentId: parsed.walletByStudentId || {},
            idempotencyOrderMap: parsed.idempotencyOrderMap || {},
            settings: parsed.settings || getDefaultState().settings,
        };
    } catch {
        return getDefaultState();
    }
};

export const saveMockState = (state: GiftShopMockState) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
};
