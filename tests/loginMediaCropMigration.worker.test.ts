// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = new URL('../workers/migrations/0088_login_media_crop.sql', import.meta.url);
const basePath = new URL('../workers/migrations/0068_login_media.sql', import.meta.url);
const databases: DatabaseSync[] = [];

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe('login media crop migration', () => {
  it('adds persisted crop defaults and database bounds for existing banners', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const db = new DatabaseSync(':memory:');
    databases.push(db);
    db.exec(readFileSync(basePath, 'utf8'));
    db.prepare(`
      INSERT INTO login_media_slides (
        id, cloudinary_public_id, image_url, created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'slide-1',
      'tohieuquiz/login-media/slide-1',
      'https://res.cloudinary.com/demo/image/upload/slide-1.webp',
      '2026-10-01T00:00:00.000Z',
      'admin',
      '2026-10-01T00:00:00.000Z',
      'admin',
    );

    db.exec(readFileSync(migrationPath, 'utf8'));

    const row = db.prepare('SELECT crop_x, crop_y, crop_zoom FROM login_media_slides WHERE id = ?')
      .get('slide-1') as Record<string, number>;
    expect(row).toEqual({ crop_x: 0.5, crop_y: 0.5, crop_zoom: 1 });

    expect(() => db.prepare('UPDATE login_media_slides SET crop_x = 1.1 WHERE id = ?').run('slide-1')).toThrow();
    expect(() => db.prepare('UPDATE login_media_slides SET crop_y = -0.1 WHERE id = ?').run('slide-1')).toThrow();
    expect(() => db.prepare('UPDATE login_media_slides SET crop_zoom = 3.1 WHERE id = ?').run('slide-1')).toThrow();
  });
});
