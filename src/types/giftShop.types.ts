export type GiftCategory = 'SNACK' | 'SUPPLY' | 'PRIVILEGE';
export type GiftCatalogScope = 'SCHOOL' | 'GRADE' | 'CLASS';
export type GiftOrderStatus = 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';
export type GiftVoucherStatus = 'ISSUED' | 'USED' | 'CANCELLED';

export interface GiftCatalogItem {
    id: string;
    name: string;
    category: GiftCategory;
    priceCoins: number;
    imageUrl: string;
    isActive: boolean;
    stockTotal: number;
    stockRemaining: number;
    lowStockThreshold: number;
    weeklyLimitPerStudent: number;
    scopeType: GiftCatalogScope;
    schoolId: string;
    classId?: string;
    gradeLevel?: number;
    createdBy?: string;
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
    itemId?: string;
    schoolId?: string;
    gradeLevel?: number;
    itemSnapshot: GiftCatalogItem;
    priceCoins: number;
    status: GiftOrderStatus;
    voucherCode: string;
    approvedBy?: string;
    approvedAt?: string;
    deliveredBy?: string;
    deliveredAt?: string;
    cancelledBy?: string;
    cancelledAt?: string;
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

export interface GiftShopEffectiveSetting {
    isOpen: boolean;
    closedReason: string;
    closedScope: 'SCHOOL' | 'CLASS' | null;
    schoolId: string;
    classId: string;
}

export interface GiftShopScopeSetting {
    id: string;
    scope_type: 'SCHOOL' | 'CLASS';
    school_id: string;
    class_id: string;
    is_open: number;
    closed_reason: string;
    updated_by: string;
    updated_at: string;
}

export interface GiftShopSettingsResponse {
    effective: GiftShopEffectiveSetting;
    settings: GiftShopScopeSetting[];
}

export interface GiftShopSettingsUpdate {
    scopeType: 'SCHOOL' | 'CLASS';
    schoolId?: string;
    classId?: string;
    isOpen: boolean;
    closedReason?: string;
}

export interface GiftShopEventLog {
    id: string;
    type:
    | 'ORDER_CREATED'
    | 'ORDER_APPROVED'
    | 'ORDER_DELIVERED'
    | 'ORDER_CANCELLED'
    | 'WALLET_REFUNDED'
    | 'CATALOG_UPDATED'
    | 'CATALOG_CREATED'
    | 'CATALOG_DELETED'
    | 'SHOP_SCOPE_UPDATED';
    orderId?: string;
    studentId?: string;
    actor?: string;
    requestId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
