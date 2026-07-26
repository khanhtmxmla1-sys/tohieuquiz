import type { GiftOrderRow } from './types';

export const ORDER_SELECT = `
    SELECT
        o.*,
        s.full_name AS student_name,
        s.username AS student_username,
        c.name AS class_name
    FROM gift_orders o
    LEFT JOIN students s ON s.id = o.student_id
    LEFT JOIN classes c ON c.id = o.class_id
`;

export const getCoinsByStudentId = async (db: D1Database, studentId: string): Promise<number> => {
    const student = await db.prepare('SELECT coins FROM students WHERE id = ?').bind(studentId).first<any>();
    return Number(student?.coins) || 0;
};

export const getOrderById = async (db: D1Database, orderId: string): Promise<GiftOrderRow | null> => {
    return await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(orderId).first<GiftOrderRow>();
};

export const findOrderByIdempotency = async (
    db: D1Database,
    idempotencyKey: string,
    studentId: string,
): Promise<GiftOrderRow | null> => {
    return await db.prepare(`${ORDER_SELECT}
        WHERE o.idempotency_key = ? AND o.student_id = ?
        LIMIT 1
    `).bind(idempotencyKey, studentId).first<GiftOrderRow>();
};
