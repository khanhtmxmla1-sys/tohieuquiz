import type {
    GiftCatalogItem,
    GiftOrder,
    GiftShopEventLog,
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
}

export interface GiftCatalogUpsertInput {
    id?: string;
    name: string;
    category: GiftCatalogItem['category'];
    priceCoins: number;
    imageUrl: string;
    isActive?: boolean;
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
}
