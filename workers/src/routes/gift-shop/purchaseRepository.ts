export const getActiveCatalogItem = async (db: D1Database, itemId: string) => await db.prepare(`
    SELECT *
    FROM gift_catalog_items
    WHERE id = ? AND is_active = 1
    LIMIT 1
`).bind(itemId).first<any>();

export const getStudentForPurchase = async (db: D1Database, studentId: string) => await db.prepare(`
    SELECT s.id, s.full_name, s.username, s.class_id, s.coins, c.name AS class_name
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.id = ?
    LIMIT 1
`).bind(studentId).first<any>();

export const buildItemSnapshot = (item: any, priceCoins: number, now: string) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    priceCoins,
    imageUrl: item.image_url || '',
    isActive: Number(item.is_active) === 1,
    createdAt: item.created_at || now,
    updatedAt: item.updated_at || now,
});
