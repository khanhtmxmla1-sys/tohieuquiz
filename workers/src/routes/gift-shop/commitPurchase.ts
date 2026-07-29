interface CommitPurchaseInput {
    orderId: string;
    idempotencyKey: string;
    studentId: string;
    classId: string;
    schoolId: string;
    gradeLevel: number | null;
    studentUsername: string;
    itemId: string;
    itemSnapshot: Record<string, unknown>;
    priceCoins: number;
    weekKey: string;
    requestId: string;
    now: string;
}

export const commitPurchase = async (db: D1Database, input: CommitPurchaseInput) => {
    await db.prepare(`
        INSERT INTO gift_orders
        (id, idempotency_key, student_id, class_id, item_id, school_id, grade_level, week_key,
         item_snapshot, price_coins, status, voucher_code, transition_actor,
         transition_request_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', '', ?, ?, ?, ?)
    `).bind(
        input.orderId, input.idempotencyKey, input.studentId, input.classId, input.itemId,
        input.schoolId, input.gradeLevel, input.weekKey, JSON.stringify(input.itemSnapshot),
        input.priceCoins, input.studentUsername, input.requestId, input.now, input.now,
    ).run();
};
