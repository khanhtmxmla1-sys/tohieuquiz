import type { CatalogPayload } from './types';
import { nowIso } from './values';

export const ensureCatalogSeed = async (db: D1Database) => {
    const countRow = await db.prepare('SELECT COUNT(*) AS cnt FROM gift_catalog_items').first<{ cnt: number }>();
    if ((Number(countRow?.cnt) || 0) > 0) return;
    const now = nowIso();
    const defaults = [
        ['gift_snack_01', 'Sữa chua', 'SNACK', 120, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Cup%20with%20straw/3D/cup_with_straw_3d.png'],
        ['gift_supply_01', 'Bút chì HB', 'SUPPLY', 180, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Pencil/3D/pencil_3d.png'],
        ['gift_privilege_01', 'Đổi chỗ ngồi 1 buổi', 'PRIVILEGE', 400, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crown/3D/crown_3d.png'],
    ];
    await db.batch(defaults.map(([id, name, category, price, image]) => db.prepare(`
        INSERT INTO gift_catalog_items
        (id, name, category, price_coins, image_url, is_active, created_at, updated_at,
         stock_total, stock_remaining, low_stock_threshold, weekly_limit_per_student,
         scope_type, school_id, class_id, grade_level, created_by)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, 100, 100, 5, 1, 'SCHOOL', '', NULL, NULL, 'system')
    `).bind(id, name, category, price, image, now, now)));
};

export const listCatalogItems = async (
    db: D1Database,
    context: { role: 'student' | 'teacher' | 'admin'; studentId?: string; username?: string; classScope?: string },
) => {
    if (context.role === 'admin') {
        return await db.prepare(`SELECT * FROM gift_catalog_items WHERE is_active = 1 ORDER BY category, name`).all();
    }
    if (context.role === 'student') {
        return await db.prepare(`
            SELECT item.*
            FROM gift_catalog_items item
            JOIN students student ON student.id = ? AND COALESCE(student.archived_at, '') = ''
            JOIN classes classroom ON classroom.id = student.class_id AND COALESCE(classroom.archived_at, '') = ''
            WHERE item.is_active = 1
              AND (item.school_id = '' OR item.school_id = classroom.teacher_username)
              AND (
                item.scope_type = 'SCHOOL'
                OR (item.scope_type = 'CLASS' AND COALESCE(item.class_id, '') = student.class_id)
                OR (item.scope_type = 'GRADE' AND item.grade_level = CAST(substr(classroom.name, 1, 1) AS INTEGER))
              )
            ORDER BY item.category, item.name
        `).bind(context.studentId || '').all();
    }
    return await db.prepare(`
        SELECT DISTINCT item.*
        FROM gift_catalog_items item
        JOIN classes classroom
          ON classroom.teacher_username = ?
         AND COALESCE(classroom.archived_at, '') = ''
         AND (? = '' OR classroom.id = ? OR classroom.name = ?)
        WHERE item.is_active = 1
          AND (item.school_id = '' OR item.school_id = classroom.teacher_username)
          AND (
            item.scope_type = 'SCHOOL'
            OR (item.scope_type = 'CLASS' AND COALESCE(item.class_id, '') = classroom.id)
            OR (item.scope_type = 'GRADE' AND item.grade_level = CAST(substr(classroom.name, 1, 1) AS INTEGER))
          )
        ORDER BY item.category, item.name
    `).bind(context.username || '', context.classScope || '', context.classScope || '', context.classScope || '').all();
};

export const getCatalogItemById = async (db: D1Database, itemId: string) =>
    await db.prepare('SELECT * FROM gift_catalog_items WHERE id = ?').bind(itemId).first<any>();

export const insertCatalogItem = async (
    db: D1Database,
    id: string,
    payload: CatalogPayload,
    actor: string,
) => {
    const now = nowIso();
    await db.prepare(`
        INSERT INTO gift_catalog_items
        (id, name, category, price_coins, image_url, is_active, created_at, updated_at,
         stock_total, stock_remaining, low_stock_threshold, weekly_limit_per_student,
         scope_type, school_id, class_id, grade_level, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id, payload.name, payload.category, payload.priceCoins, payload.imageUrl, payload.isActive,
        now, now, payload.stockTotal, payload.stockTotal, payload.lowStockThreshold,
        payload.weeklyLimitPerStudent, payload.scopeType, payload.schoolId,
        payload.classId, payload.gradeLevel, actor,
    ).run();
};

export const updateCatalogItem = async (db: D1Database, itemId: string, payload: CatalogPayload) => {
    await db.prepare(`
        UPDATE gift_catalog_items
        SET name = ?, category = ?, price_coins = ?, image_url = ?, is_active = ?,
            stock_remaining = MIN(?, MAX(0, stock_remaining + (? - stock_total))),
            stock_total = ?, low_stock_threshold = ?, weekly_limit_per_student = ?,
            scope_type = ?, school_id = ?, class_id = ?, grade_level = ?, updated_at = ?
        WHERE id = ?
    `).bind(
        payload.name, payload.category, payload.priceCoins, payload.imageUrl, payload.isActive,
        payload.stockTotal, payload.stockTotal, payload.stockTotal, payload.lowStockThreshold,
        payload.weeklyLimitPerStudent, payload.scopeType, payload.schoolId, payload.classId,
        payload.gradeLevel, nowIso(), itemId,
    ).run();
};

export const deactivateCatalogItem = async (db: D1Database, itemId: string) => {
    await db.prepare('UPDATE gift_catalog_items SET is_active = 0, updated_at = ? WHERE id = ?')
        .bind(nowIso(), itemId).run();
};
