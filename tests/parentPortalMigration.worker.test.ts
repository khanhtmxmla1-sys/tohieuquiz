import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARENT_NOTIFICATION_KINDS } from '../shared/parent-portal.contract';

describe('parent portal schema', () => {
  it('defines every canonical table and index', () => {
    const sql = readFileSync('workers/migrations/0037_add_parent_portal_complete.sql', 'utf8');

    expect(sql).toContain('ALTER TABLE results ADD COLUMN student_id TEXT');
    expect(sql).toContain('CREATE TABLE parent_links');
    expect(sql).toContain('CREATE TABLE parent_activation_tokens');
    expect(sql).toContain('CREATE TABLE parent_notifications');
    expect(sql).toContain('CREATE TABLE parent_class_announcements');
    expect(sql).toContain('idx_parent_links_one_active_student');
    expect(sql).toContain('idx_parent_notifications_unique_source');
    expect(sql).toContain('idx_results_student_id_submitted');
  });

  it('keeps notification kinds stable', () => {
    expect(PARENT_NOTIFICATION_KINDS).toEqual([
      'quiz_result',
      'result_report',
      'homework_assigned',
      'homework_due',
      'homework_graded',
      'class_announcement',
      'certificate_issued',
    ]);
  });
});
