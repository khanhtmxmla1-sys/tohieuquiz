export type GiftCategory = 'SNACK' | 'SUPPLY' | 'PRIVILEGE';

export type GiftOrderStatus =
    | 'CREATED'
    | 'VOUCHER_ISSUED'
    | 'DELIVERED'
    | 'CANCELLED_REFUNDED';

export type GiftVoucherStatus = 'ISSUED' | 'USED' | 'CANCELLED';

export interface GiftCatalogItem {
    id: string;
    name: string;
    category: GiftCategory;
    priceCoins: number;
    imageUrl: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface GiftVoucher {
    code: string;
    orderId: string;
    studentId: string;
    issuedAt: string;
    status: GiftVoucherStatus;
}

export interface GiftOrder {
    id: string;
    studentId: string;
    studentName: string;
    studentUsername: string;
    classId: string;
    className?: string;
    itemSnapshot: GiftCatalogItem;
    priceCoins: number;
    status: GiftOrderStatus;
    voucherCode: string;
    deliveredBy?: string;
    deliveredAt?: string;
    cancelReason?: string;
    createdAt: string;
    updatedAt: string;
}

export type WalletLedgerReason = 'PURCHASE' | 'REFUND' | 'MANUAL_ADJUST';

export interface WalletLedgerEntry {
    id: string;
    studentId: string;
    deltaCoins: number;
    reason: WalletLedgerReason;
    refOrderId?: string;
    createdAt: string;
}

export interface GiftPurchasePayload {
    studentId: string;
    studentName: string;
    studentUsername: string;
    classId: string;
    className?: string;
    itemId: string;
    currentCoins: number;
    idempotencyKey: string;
}

export interface GiftPurchaseResponse {
    orderId: string;
    voucherCode: string;
    newCoins: number;
    status: GiftOrderStatus;
    idempotencyReplay: boolean;
    order: GiftOrder;
}

export interface GiftOrderQuery {
    studentId?: string;
    classId?: string;
    status?: GiftOrderStatus | 'ALL';
    actorUsername?: string;
    actorIsAdmin?: boolean;
    actorTeacherClass?: string;
}

export interface GiftOrderActor {
    username: string;
    isAdmin: boolean;
    teacherClass?: string | null;
}

export interface GiftShopEventLog {
    id: string;
    type:
    | 'ORDER_CREATED'
    | 'VOUCHER_ISSUED'
    | 'ORDER_DELIVERED'
    | 'ORDER_CANCELLED'
    | 'WALLET_REFUNDED'
    | 'CATALOG_UPDATED'
    | 'CATALOG_CREATED'
    | 'CATALOG_DELETED';
    orderId?: string;
    studentId?: string;
    actor?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
