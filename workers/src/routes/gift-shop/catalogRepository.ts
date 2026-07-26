import type { CatalogPayload } from './types';
import { nowIso } from './values';

export const ensureCatalogSeed = async (db: D1Database) => {
    const countRow = await db.prepare('SELECT COUNT(*) AS cnt FROM gift_catalog_items').first<{ cnt: number }>();
    const count = Number(countRow?.cnt) || 0;
    if (count > 0) return;

    const now = nowIso();
    await db.batch([
        db.prepare('INSERT INTO gift_catalog_items (id, name, category, price_coins, image_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
            .bind('gift_snack_01', 'Sua chua', 'SNACK', 120, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Cup%20with%20straw/3D/cup_with_straw_3d.png', now, now),
        db.prepare('INSERT INTO gift_catalog_items (id, name, category, price_coins, image_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
            .bind('gift_supply_01', 'But chi HB', 'SUPPLY', 180, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Pencil/3D/pencil_3d.png', now, now),
        db.prepare('INSERT INTO gift_catalog_items (id, name, category, price_coins, image_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
            .bind('gift_privilege_01', 'Doi cho ngoi 1 buoi', 'PRIVILEGE', 400, 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crown/3D/crown_3d.png', now, now),
    ]);
};

export const listActiveCatalogItems = async (db: D1Database) => await db.prepare(`
    SELECT *
    FROM gift_catalog_items
    WHERE is_active = 1
    ORDER BY category ASC, name ASC
`).all();

export const getCatalogItemById = async (db: D1Database, itemId: string) =>
    await db.prepare('SELECT * FROM gift_catalog_items WHERE id = ?').bind(itemId).first<any>();

export const insertCatalogItem = async (db: D1Database, id: string, payload: CatalogPayload) => {
    const now = nowIso();
    await db.prepare(`
        INSERT INTO gift_catalog_items (id, name, category, price_coins, image_url, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, payload.name, payload.category, payload.priceCoins, payload.imageUrl, payload.isActive, now, now).run();
};

export const updateCatalogItem = async (db: D1Database, itemId: string, payload: CatalogPayload) => {
    await db.prepare(`
        UPDATE gift_catalog_items
        SET name = ?, category = ?, price_coins = ?, image_url = ?, is_active = ?, updated_at = ?
        WHERE id = ?
    `).bind(payload.name, payload.category, payload.priceCoins, payload.imageUrl, payload.isActive, nowIso(), itemId).run();
};

export const deactivateCatalogItem = async (db: D1Database, itemId: string) => {
    await db.prepare(`
        UPDATE gift_catalog_items
        SET is_active = 0, updated_at = ?
        WHERE id = ?
    `).bind(nowIso(), itemId).run();
};
