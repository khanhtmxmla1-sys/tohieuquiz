export const getActiveCatalogItem = async (db: D1Database, itemId: string) => await db.prepare(`
    SELECT * FROM gift_catalog_items WHERE id = ? AND is_active = 1 LIMIT 1
`).bind(itemId).first<any>();

export const getStudentForPurchase = async (db: D1Database, studentId: string) => await db.prepare(`
    SELECT s.id, s.full_name, s.username, s.class_id, s.coins,
           c.name AS class_name, c.teacher_username AS school_id
    FROM students s
    JOIN classes c ON c.id = s.class_id AND COALESCE(c.archived_at, '') = ''
    WHERE s.id = ? AND COALESCE(s.archived_at, '') = ''
    LIMIT 1
`).bind(studentId).first<any>();

export const buildItemSnapshot = (item: any, priceCoins: number, now: string) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    priceCoins,
    imageUrl: item.image_url || '',
    isActive: Number(item.is_active) === 1,
    stockTotal: Number(item.stock_total) || 0,
    stockRemaining: Number(item.stock_remaining) || 0,
    lowStockThreshold: Number(item.low_stock_threshold) || 0,
    weeklyLimitPerStudent: Number(item.weekly_limit_per_student) || 0,
    scopeType: item.scope_type || 'SCHOOL',
    schoolId: item.school_id || '',
    classId: item.class_id || undefined,
    gradeLevel: item.grade_level == null ? undefined : Number(item.grade_level),
    createdAt: item.created_at || now,
    updatedAt: item.updated_at || now,
});
