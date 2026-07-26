import { generateId } from '../../utils/response';
import { nowIso } from './values';

export const appendEvent = async (
    db: D1Database,
    event: {
        type: string;
        orderId?: string;
        studentId?: string;
        actor?: string;
        metadata?: Record<string, unknown>;
    },
) => {
    await db.prepare(
        'INSERT INTO gift_order_events (id, event_type, order_id, student_id, actor, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
        generateId('gevo'),
        event.type,
        event.orderId || '',
        event.studentId || '',
        event.actor || '',
        JSON.stringify(event.metadata || {}),
        nowIso(),
    ).run();
};
