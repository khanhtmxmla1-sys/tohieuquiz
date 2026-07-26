import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const approvedTemplateIds = [
  'tohieuquiz-classic-red-navy-2026',
  'tohieuquiz-modern-color-2026',
  'tohieuquiz-formal-blue-2026',
  'tohieuquiz-kids-learning-2026',
  'tohieuquiz-geometric-navy-orange-2026',
];

describe('fresh D1 bootstrap contract', () => {
  it('keeps the canonical schema aligned with the latest runtime features', () => {
    const schema = normalizeSql(readFileSync('workers/schema.sql', 'utf8'));

    for (const table of [
      'teacher_ai_daily_usage',
      'ai_generation_actions',
      'reward_receipts',
      'question_math_repairs',
      'math_render_events',
      'live_exam_sessions',
      'live_exam_participants',
      'live_exam_activity',
      'live_exam_chat_messages',
      'live_exam_question_analytics',
      'live_exam_student_timing',
      'parent_links',
      'parent_activation_tokens',
      'parent_class_announcements',
      'parent_notifications',
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }

    for (const fragment of [
      'student_name_font text',
      'achievement_prefix text',
      'date_line text',
      'is_default integer not null default 0',
      'canvas_width integer not null default 1200',
      'canvas_height integer not null default 848',
      'create index if not exists idx_questions_tags',
      'create index if not exists idx_hw_submissions_student_latest',
      'create index if not exists idx_classes_teacher_username',
      'create index if not exists idx_admin_audit_actor_created',
      'create index if not exists idx_admin_audit_target_created',
    ]) {
      expect(schema).toContain(fragment);
    }
  });

  it('seeds only non-sensitive defaults and one approved certificate template as default', () => {
    const seed = normalizeSql(readFileSync('workers/seeds/defaults.sql', 'utf8'));

    expect(seed).toContain("values ('ai_assistant_enabled', 'true', datetime('now'))");
    for (const templateId of approvedTemplateIds) {
      expect(seed).toContain(templateId);
    }
    expect(seed).toContain("when id = 'tohieuquiz-classic-red-navy-2026' then 1");
    expect(seed).not.toContain('insert into teachers');
    expect(seed).not.toContain('insert into students');
    expect(seed).not.toContain('insert into classes');
  });

  it('registers every migration file exactly once', () => {
    const migrationNames = readdirSync('workers/migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort();
    const registry = readFileSync(
      'workers/scripts/bootstrap_d1_migration_registry.sql',
      'utf8',
    );

    expect(migrationNames).toHaveLength(41);
    for (const migrationName of migrationNames) {
      const escaped = migrationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(registry.match(new RegExp(`'${escaped}'`, 'g'))).toHaveLength(1);
    }
  });

  it('uses the same new D1 database id in both Worker configurations', () => {
    const apiConfig = readFileSync('workers/wrangler.toml', 'utf8');
    const consumerConfig = readFileSync(
      'workers/wrangler.certificate-consumer.toml',
      'utf8',
    );
    const databaseId = '527fd53b-b69c-4373-9512-b0f23a96c42d';

    for (const config of [apiConfig, consumerConfig]) {
      expect(config).toContain('database_name = "tohieuquiz-db"');
      expect(config).toContain(`database_id = "${databaseId}"`);
    }
  });
});
