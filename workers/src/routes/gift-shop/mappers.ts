import type { GiftOrderRow } from './types';
import { parseJson } from './values';

export const mapCatalogItem = (row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    priceCoins: Number(row.price_coins) || 0,
    imageUrl: row.image_url || '',
    isActive: Number(row.is_active) === 1,
    stockTotal: Math.max(0, Number(row.stock_total) || 0),
    stockRemaining: Math.max(0, Number(row.stock_remaining) || 0),
    lowStockThreshold: Math.max(0, Number(row.low_stock_threshold) || 0),
    weeklyLimitPerStudent: Math.max(0, Number(row.weekly_limit_per_student) || 0),
    scopeType: row.scope_type || 'SCHOOL',
    schoolId: row.school_id || '',
    classId: row.class_id || undefined,
    gradeLevel: row.grade_level == null ? undefined : Number(row.grade_level),
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
});

export const mapOrder = (row: GiftOrderRow) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name || '',
    studentUsername: row.student_username || '',
    classId: row.class_id,
    className: row.class_name || '',
    itemId: row.item_id || '',
    schoolId: row.school_id || '',
    gradeLevel: row.grade_level == null ? undefined : Number(row.grade_level),
    itemSnapshot: parseJson(row.item_snapshot, {}),
    priceCoins: Number(row.price_coins) || 0,
    status: row.status,
    voucherCode: row.voucher_code || '',
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    deliveredBy: row.delivered_by || undefined,
    deliveredAt: row.delivered_at || undefined,
    cancelledBy: row.cancelled_by || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancelReason: row.cancel_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const mapEvent = (row: any) => ({
    id: row.id,
    type: row.event_type,
    orderId: row.order_id || undefined,
    studentId: row.student_id || undefined,
    actor: row.actor || undefined,
    requestId: row.request_id || undefined,
    createdAt: row.created_at || '',
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
});
