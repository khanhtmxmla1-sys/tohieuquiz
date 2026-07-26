import { generateId } from '../../utils/response';

export const commitDelivery = async (
    db: D1Database,
    input: { orderId: string; studentId: string; actorUsername: string; now: string },
) => {
    await db.batch([
        db.prepare(`
            UPDATE gift_orders
            SET status = 'DELIVERED', delivered_by = ?, delivered_at = ?, updated_at = ?
            WHERE id = ?
        `).bind(input.actorUsername, input.now, input.now, input.orderId),
        db.prepare(`
            UPDATE gift_vouchers
            SET status = 'USED'
            WHERE order_id = ?
        `).bind(input.orderId),
        db.prepare(`
            INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at)
            VALUES (?, 'ORDER_DELIVERED', ?, ?, ?, ?, ?)
        `).bind(
            generateId('gevo'),
            input.orderId,
            input.studentId,
            input.actorUsername,
            '{}',
            input.now,
        ),
    ]);
};
