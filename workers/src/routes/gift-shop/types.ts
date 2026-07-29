export type GiftOrderStatus = 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';
export type GiftCatalogScope = 'SCHOOL' | 'GRADE' | 'CLASS';

export interface GiftOrderRow {
    id: string;
    student_id: string;
    class_id: string;
    item_id: string;
    school_id: string;
    grade_level?: number | null;
    week_key: string;
    item_snapshot: string;
    price_coins: number;
    status: GiftOrderStatus;
    voucher_code: string;
    approved_by?: string;
    approved_at?: string;
    delivered_by?: string;
    delivered_at?: string;
    cancelled_by?: string;
    cancelled_at?: string;
    cancel_reason?: string;
    transition_actor?: string;
    transition_request_id?: string;
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
    stockTotal: number;
    lowStockThreshold: number;
    weeklyLimitPerStudent: number;
    scopeType: GiftCatalogScope;
    schoolId: string;
    classId: string | null;
    gradeLevel: number | null;
}

export interface ActorAccess {
    isAdmin: boolean;
    teacherClass: string;
    schoolId: string;
}
