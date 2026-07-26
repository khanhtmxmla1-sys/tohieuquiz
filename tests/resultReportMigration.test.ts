import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(root, 'workers', 'migrations', '0032_add_result_report_delivery.sql');
const rollbackPath = path.join(root, 'workers', 'rollbacks', '0032_drop_result_report_delivery.sql');
const schemaPath = path.join(root, 'workers', 'schema.sql');
const auditPath = path.join(root, 'workers', 'scripts', 'audit_d1_migration_state.sql');

const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

describe('result report delivery migration', () => {
  it('adds backwards-compatible delivery metadata to phieu_batch', () => {
    const sql = normalizeSql(fs.readFileSync(migrationPath, 'utf8'));

    for (const column of [
      'request_id text',
      'quiz_id text',
      'attempt_policy text',
      'notify_students integer',
      'create_parent_links integer',
      'delivery_status text',
      'updated_at text',
    ]) {
      expect(sql).toContain(`alter table phieu_batch add column ${column}`);
    }
    expect(sql).toContain('create unique index if not exists idx_phieu_batch_teacher_request');
    expect(sql).toContain('on phieu_batch (teacher_id, request_id)');
    expect(sql).toContain('where request_id is not null');
  });

  it('creates idempotent per-result delivery items and lookup indexes', () => {
    const sql = normalizeSql(fs.readFileSync(migrationPath, 'utf8'));

    expect(sql).toContain('create table if not exists result_report_delivery_items');
    for (const column of [
      'batch_id text not null',
      'result_id text not null',
      'phieu_id text',
      'student_id text',
      'student_name text not null',
      'parent_phone text',
      'notification_id text',
      'public_link_id text',
      'student_status text not null',
      'parent_status text not null',
      'draft_json text not null',
      'attempt_count integer not null',
      'last_error text',
      'created_at text not null',
      'updated_at text not null',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('unique (batch_id, result_id)');
    for (const index of [
      'idx_result_report_items_batch',
      'idx_result_report_items_student',
      'idx_result_report_items_notification',
      'idx_result_report_items_public_link',
    ]) {
      expect(sql).toContain(`create index if not exists ${index}`);
    }
  });

  it('keeps rollback safe for an ALTER-based D1 migration', () => {
    const rollback = normalizeSql(fs.readFileSync(rollbackPath, 'utf8'));

    expect(rollback).toContain('drop table if exists result_report_delivery_items');
    expect(rollback).toContain('drop index if exists idx_phieu_batch_teacher_request');
    expect(rollback).not.toContain('drop column');
    expect(rollback).not.toContain('drop table if exists phieu_batch');
  });

  it('keeps schema and production audit aligned with migration 0032', () => {
    const schema = normalizeSql(fs.readFileSync(schemaPath, 'utf8'));
    const audit = fs.readFileSync(auditPath, 'utf8');

    expect(schema).toContain('create table if not exists result_report_delivery_items');
    expect(schema).toContain('request_id text');
    expect(schema).toContain('delivery_status text');
    expect(audit).toContain("0032_add_result_report_delivery.sql");
    expect(audit).toContain('result_report_delivery_items');
    expect(audit).toContain('idx_phieu_batch_teacher_request');
  });
});
