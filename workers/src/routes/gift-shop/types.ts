export type GiftOrderStatus = 'CREATED' | 'VOUCHER_ISSUED' | 'DELIVERED' | 'CANCELLED_REFUNDED';

export interface GiftOrderRow {
    id: string;
    student_id: string;
    class_id: string;
    item_snapshot: string;
    price_coins: number;
    status: GiftOrderStatus;
    voucher_code: string;
    delivered_by?: string;
    delivered_at?: string;
    cancel_reason?: string;
    created_at: string;
    updated_at: string;
    student_name?: string;
    student_username?: string;
    class_name?: string;
}

export interface CatalogPayload {
    name: string;
    category: string;
    imageUrl: string;
    priceCoins: number;
    isActive: number;
}

export interface ActorAccess {
    isAdmin: boolean;
    teacherClass: string;
}
