// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0068_login_media.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('login media migration', () => {
  it('creates a safe CONTENT default and enforces carousel constraints', () => {
    db = new DatabaseSync(':memory:');
    expect(() => db!.exec(readFileSync(migrationPath, 'utf8'))).not.toThrow();

    expect(db.prepare(`
      SELECT id, display_mode, autoplay, interval_ms, transition, version
      FROM login_media_settings WHERE id = 'default'
    `).get()).toEqual({
      id: 'default',
      display_mode: 'CONTENT',
      autoplay: 1,
      interval_ms: 5000,
      transition: 'FADE',
      version: 1,
    });

    expect(() => db!.prepare(`
      UPDATE login_media_settings SET interval_ms = 1000 WHERE id = 'default'
    `).run()).toThrow();
    expect(() => db!.prepare(`
      UPDATE login_media_settings SET transition = 'FLIP' WHERE id = 'default'
    `).run()).toThrow();

    expect(() => db!.prepare(`
      INSERT INTO login_media_slides (
        id, cloudinary_public_id, image_url, image_width, image_height,
        alt_text, internal_title, link_url, open_new_tab, sort_order, enabled,
        starts_at, ends_at, created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'slide-1',
      'tohieuquiz/login-media/2026/08/slide-1',
      'https://res.cloudinary.com/demo/image/upload/slide-1.webp',
      1200,
      520,
      'Banner',
      'Banner nội bộ',
      '/practice',
      0,
      10,
      0,
      '2026-08-13T00:00:00.000Z',
      '2026-08-14T00:00:00.000Z',
      '2026-08-12T00:00:00.000Z',
      'admin-1',
      '2026-08-12T00:00:00.000Z',
      'admin-1',
    )).not.toThrow();

    expect(() => db!.prepare(`
      INSERT INTO login_media_slides (
        id, cloudinary_public_id, image_url, starts_at, ends_at,
        created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'invalid-schedule',
      'tohieuquiz/login-media/2026/08/invalid',
      'https://res.cloudinary.com/demo/image/upload/invalid.webp',
      '2026-08-14T00:00:00.000Z',
      '2026-08-13T00:00:00.000Z',
      '2026-08-12T00:00:00.000Z',
      'admin-1',
      '2026-08-12T00:00:00.000Z',
      'admin-1',
    )).toThrow();

    const indexes = db.prepare("PRAGMA index_list('login_media_slides')").all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain('idx_login_media_slides_active_order');
  });

  it('keeps fresh schema, migration audit and registry aligned with 0068', () => {
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const audit = readFileSync('workers/scripts/audit_d1_migration_state.sql', 'utf8');
    const registry = readFileSync('workers/scripts/bootstrap_d1_migration_registry.sql', 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS login_media_settings');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS login_media_slides');
    expect(schema).toContain('idx_login_media_slides_active_order');
    expect(audit).toContain("('0068_login_media.sql', 'login media tables'");
    expect(registry).toContain("('0068_login_media.sql')");
  });
});
