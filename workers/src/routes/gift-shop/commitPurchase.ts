import { generateId } from '../../utils/response';

interface CommitPurchaseInput {
    orderId: string;
    idempotencyKey: string;
    studentId: string;
    classId: string;
    studentUsername: string;
    itemId: string;
    itemSnapshot: Record<string, unknown>;
    priceCoins: number;
    voucherCode: string;
    now: string;
}

export const commitPurchase = async (db: D1Database, input: CommitPurchaseInput) => {
    await db.batch([
        db.prepare('UPDATE students SET coins = coins - ? WHERE id = ?')
            .bind(input.priceCoins, input.studentId),
        db.prepare(`
            INSERT INTO gift_orders
            (id, idempotency_key, student_id, class_id, item_snapshot, price_coins, status, voucher_code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'VOUCHER_ISSUED', ?, ?, ?)
        `).bind(
            input.orderId,
            input.idempotencyKey,
            input.studentId,
            input.classId,
            JSON.stringify(input.itemSnapshot),
            input.priceCoins,
            input.voucherCode,
            input.now,
            input.now,
        ),
        db.prepare(`
            INSERT INTO gift_vouchers (code, order_id, student_id, issued_at, status)
            VALUES (?, ?, ?, ?, 'ISSUED')
        `).bind(input.voucherCode, input.orderId, input.studentId, input.now),
        db.prepare(`
            INSERT INTO gift_wallet_ledger (id, student_id, delta_coins, reason, ref_order_id, created_at)
            VALUES (?, ?, ?, 'PURCHASE', ?, ?)
        `).bind(generateId('gled'), input.studentId, -input.priceCoins, input.orderId, input.now),
        db.prepare(`
            INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at)
            VALUES (?, 'ORDER_CREATED', ?, ?, ?, ?, ?)
        `).bind(
            generateId('gevo'),
            input.orderId,
            input.studentId,
            input.studentUsername,
            JSON.stringify({ itemId: input.itemId, priceCoins: input.priceCoins }),
            input.now,
        ),
        db.prepare(`
            INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at)
            VALUES (?, 'VOUCHER_ISSUED', ?, ?, ?, ?, ?)
        `).bind(
            generateId('gevo'),
            input.orderId,
            input.studentId,
            input.studentUsername,
            JSON.stringify({ voucherCode: input.voucherCode }),
            input.now,
        ),
    ]);
};
