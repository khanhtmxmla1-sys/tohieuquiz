import { generateId } from '../../utils/response';

interface CommitCancellationInput {
    orderId: string;
    studentId: string;
    actorUsername: string;
    reason: string;
    refundAmount: number;
    now: string;
}

export const commitCancellation = async (db: D1Database, input: CommitCancellationInput) => {
    await db.batch([
        db.prepare('UPDATE students SET coins = coins + ? WHERE id = ?')
            .bind(input.refundAmount, input.studentId),
        db.prepare(`
            UPDATE gift_orders
            SET status = 'CANCELLED_REFUNDED', cancel_reason = ?, delivered_by = ?, delivered_at = ?, updated_at = ?
            WHERE id = ?
        `).bind(input.reason, input.actorUsername, input.now, input.now, input.orderId),
        db.prepare(`
            UPDATE gift_vouchers
            SET status = 'CANCELLED'
            WHERE order_id = ?
        `).bind(input.orderId),
        db.prepare(`
            INSERT INTO gift_wallet_ledger (id, student_id, delta_coins, reason, ref_order_id, created_at)
            VALUES (?, ?, ?, 'REFUND', ?, ?)
        `).bind(generateId('gled'), input.studentId, input.refundAmount, input.orderId, input.now),
        db.prepare(`
            INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at)
            VALUES (?, 'ORDER_CANCELLED', ?, ?, ?, ?, ?)
        `).bind(
            generateId('gevo'),
            input.orderId,
            input.studentId,
            input.actorUsername,
            JSON.stringify({ reason: input.reason }),
            input.now,
        ),
        db.prepare(`
            INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at)
            VALUES (?, 'WALLET_REFUNDED', ?, ?, ?, ?, ?)
        `).bind(
            generateId('gevo'),
            input.orderId,
            input.studentId,
            input.actorUsername,
            JSON.stringify({ amount: input.refundAmount }),
            input.now,
        ),
    ]);
};
