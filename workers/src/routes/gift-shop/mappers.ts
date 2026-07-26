import type { GiftOrderRow } from './types';
import { parseJson } from './values';

export const mapCatalogItem = (row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    priceCoins: Number(row.price_coins) || 0,
    imageUrl: row.image_url || '',
    isActive: Number(row.is_active) === 1,
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
    itemSnapshot: parseJson(row.item_snapshot, {}),
    priceCoins: Number(row.price_coins) || 0,
    status: row.status,
    voucherCode: row.voucher_code,
    deliveredBy: row.delivered_by || undefined,
    deliveredAt: row.delivered_at || undefined,
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
    createdAt: row.created_at || '',
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
});
