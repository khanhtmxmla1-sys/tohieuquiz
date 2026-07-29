import type {
    GiftCatalogItem,
    GiftOrder,
    GiftShopEventLog,
    GiftShopSettingsResponse,
    GiftShopSettingsUpdate,
    GiftVoucher,
    WalletLedgerEntry,
} from '../../types/giftShop.types';

export type GiftShopMode = 'mock' | 'api';

export interface GiftShopMockState {
    catalog: GiftCatalogItem[];
    orders: GiftOrder[];
    vouchers: GiftVoucher[];
    ledger: WalletLedgerEntry[];
    walletByStudentId: Record<string, number>;
    idempotencyOrderMap: Record<string, string>;
    events: GiftShopEventLog[];
    settings: GiftShopSettingsResponse;
}

export interface GiftCatalogUpsertInput {
    id?: string;
    name: string;
    category: GiftCatalogItem['category'];
    priceCoins: number;
    imageUrl: string;
    isActive?: boolean;
    stockTotal: number;
    lowStockThreshold: number;
    weeklyLimitPerStudent: number;
    scopeType: GiftCatalogItem['scopeType'];
    schoolId?: string;
    classId?: string;
    gradeLevel?: number;
    actorIsAdmin?: boolean;
}

export interface GiftCatalogDeleteInput {
    id: string;
    actorIsAdmin?: boolean;
    actorUsername?: string;
}

export interface GiftCancelResult {
    order: GiftOrder;
    newCoins: number;
    refundedCoins: number;
    idempotencyReplay: boolean;
}

export type { GiftShopSettingsResponse, GiftShopSettingsUpdate };
