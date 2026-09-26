// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createSqliteD1 } from './helpers/sqliteD1';
import {
  deleteCredential,
  getAiDefaultSource,
  listCredentialSummaries,
  saveAiDefaultSource,
  saveCredential,
} from '../workers/src/services/aiCredentials/repository';

const migrationPath = 'workers/migrations/0083_teacher_ai_credentials.sql';
const preferenceMigrationPath = 'workers/migrations/0084_teacher_ai_preferences.sql';
let sqlite: DatabaseSync | null = null;

const setup = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher'
    );
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY,
      audience TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      allow_users_json TEXT NOT NULL DEFAULT '[]',
      allow_classes_json TEXT NOT NULL DEFAULT '[]',
      starts_at TEXT,
      ends_at TEXT,
      stop_conditions_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
    );
    CREATE TABLE ai_generation_actions (
      action_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      workflow TEXT NOT NULL,
      status TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      upstream_calls INTEGER NOT NULL DEFAULT 0,
      ocr_calls INTEGER NOT NULL DEFAULT 0,
      generate_calls INTEGER NOT NULL DEFAULT 0,
      review_calls INTEGER NOT NULL DEFAULT 0,
      repair_calls INTEGER NOT NULL DEFAULT 0,
      failure_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    INSERT INTO teachers (username, password, full_name, role) VALUES
      ('teacher-a', 'x', 'Teacher A', 'teacher'),
      ('teacher-b', 'x', 'Teacher B', 'teacher');
  `);
  sqlite.exec(readFileSync(migrationPath, 'utf8'));
  sqlite.exec(readFileSync(preferenceMigrationPath, 'utf8'));
  return { sqlite, db: createSqliteD1(sqlite) };
};

const cipher = {
  formatVersion: 1 as const,
  keyId: 'key-1',
  iv: Buffer.alloc(12, 1).toString('base64'),
  ciphertext: Buffer.from('ciphertext-with-tag').toString('base64'),
};

afterEach(() => {
  sqlite?.close();
  sqlite = null;
});

describe('teacher AI credentials migration and repository', () => {
  it('creates owner-scoped credentials, disabled teacher rollout, and BYOK action columns', () => {
    const { sqlite: db } = setup();

    expect(db.prepare(`
      SELECT enabled FROM feature_flags WHERE flag_key = 'teacher_ai_byok_v1'
    `).get()).toEqual({ enabled: 0 });
    expect(db.prepare(`
      SELECT audience, percentage FROM feature_flag_rules WHERE flag_key = 'teacher_ai_byok_v1'
    `).get()).toEqual({ audience: 'teacher', percentage: 0 });

    const columns = db.prepare('PRAGMA table_info(ai_generation_actions)').all() as Array<{ name: string }>;
    expect(columns.map((row) => row.name)).toEqual(expect.arrayContaining([
      'source', 'credential_version', 'ai_model', 'active_stage', 'active_stage_started_at',
    ]));
  });

  it('enforces one credential per owner/provider and cascades when the teacher is deleted', () => {
    const { sqlite: db } = setup();
    db.prepare(`
      INSERT INTO teacher_ai_credentials
      (username, provider, ciphertext, iv, key_id, format_version, last4, version, verified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 1, datetime('now'), datetime('now'), datetime('now'))
    `).run('teacher-a', 'gemini', cipher.ciphertext, cipher.iv, cipher.keyId, '1234');

    expect(() => db.prepare(`
      INSERT INTO teacher_ai_credentials
      (username, provider, ciphertext, iv, key_id, format_version, last4, version, verified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 1, datetime('now'), datetime('now'), datetime('now'))
    `).run('teacher-a', 'gemini', cipher.ciphertext, cipher.iv, cipher.keyId, '5678')).toThrow();

    db.prepare("DELETE FROM teachers WHERE username = 'teacher-a'").run();
    expect(db.prepare("SELECT * FROM teacher_ai_credentials WHERE username = 'teacher-a'").all()).toEqual([]);
  });

  it('supports optimistic create/update/delete without crossing owners', async () => {
    const { db } = setup();

    const created = await saveCredential(db, 'teacher-a', 'gemini', cipher, '1234', 0);
    expect(created).toMatchObject({ provider: 'gemini', configured: true, last4: '1234', version: 1 });

    await expect(saveCredential(db, 'teacher-a', 'gemini', cipher, '5678', 0))
      .rejects.toThrow('AI_KEY_VERSION_CONFLICT');
    await expect(saveCredential(db, 'teacher-a', 'gemini', cipher, '5678', 99))
      .rejects.toThrow('AI_KEY_VERSION_CONFLICT');

    const updated = await saveCredential(db, 'teacher-a', 'gemini', cipher, '5678', 1);
    expect(updated).toMatchObject({ last4: '5678', version: 2 });

    expect(await listCredentialSummaries(db, 'teacher-b')).toEqual([]);
    await expect(deleteCredential(db, 'teacher-b', 'gemini', 2)).resolves.toBe(false);
    await expect(deleteCredential(db, 'teacher-a', 'gemini', 1))
      .rejects.toThrow('AI_KEY_VERSION_CONFLICT');
    await expect(deleteCredential(db, 'teacher-a', 'gemini', 2)).resolves.toBe(true);
    expect(await listCredentialSummaries(db, 'teacher-a')).toEqual([]);
  });

  it('stores an isolated default source and cascades preferences with the owner', async () => {
    const { sqlite: raw, db } = setup();

    await expect(getAiDefaultSource(db, 'teacher-a')).resolves.toBe('system');
    await expect(saveAiDefaultSource(db, 'teacher-a', 'gemini-personal'))
      .resolves.toBe('gemini-personal');
    await expect(getAiDefaultSource(db, 'teacher-a')).resolves.toBe('gemini-personal');
    await expect(getAiDefaultSource(db, 'teacher-b')).resolves.toBe('system');

    expect(() => raw.prepare(`
      INSERT INTO teacher_ai_preferences (username, default_source, updated_at)
      VALUES ('teacher-b', 'openai-personal', datetime('now'))
    `).run()).toThrow();

    raw.prepare("DELETE FROM teachers WHERE username = 'teacher-a'").run();
    expect(raw.prepare("SELECT * FROM teacher_ai_preferences WHERE username = 'teacher-a'").all())
      .toEqual([]);
  });
});
