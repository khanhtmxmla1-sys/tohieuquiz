import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

describe('0042 unified notifications migration', () => {
  it('adds channel-aware system announcement metadata', () => {
    const sql = normalizeSql(
      readFileSync('workers/migrations/0042_unified_notifications.sql', 'utf8'),
    );

    for (const column of [
      'priority text not null default',
      'channels_json text not null default',
      'dismissible integer not null default',
      'cta_label text',
      'surface_overrides_json text not null default',
    ]) {
      expect(sql).toContain(`alter table announcements add column ${column}`);
    }

    expect(sql).toContain("'info', 'reminder', 'important', 'urgent'");
    expect(sql).toContain('update announcements');
    expect(sql).toContain('is_banner_active');
    expect(sql).toContain('is_active');
  });

  it('extends the personal inbox without creating a parallel notification table', () => {
    const sql = normalizeSql(
      readFileSync('workers/migrations/0042_unified_notifications.sql', 'utf8'),
    );

    for (const column of [
      'priority text not null default',
      'action_url text',
      'source_type text',
      'source_id text',
      'expires_at text',
    ]) {
      expect(sql).toContain(`alter table notifications add column ${column}`);
    }

    expect(sql).not.toContain('create table notifications');
    expect(sql).toContain('create index if not exists idx_notifications_inbox');
    expect(sql).toContain('create unique index if not exists idx_notifications_source_dedupe');
    expect(sql).toContain('where source_type is not null and source_id is not null');
  });

  it('keeps the canonical schema aligned with migration 0042', () => {
    const schema = normalizeSql(readFileSync('workers/schema.sql', 'utf8'));

    expect(schema).toContain('channels_json text not null');
    expect(schema).toContain('surface_overrides_json text not null');
    expect(schema).toContain('action_url text');
    expect(schema).toContain('source_type text');
    expect(schema).toContain('idx_notifications_inbox');
    expect(schema).toContain('idx_notifications_source_dedupe');
  });
});
