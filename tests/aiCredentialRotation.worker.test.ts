// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential } from '../workers/src/services/aiCredentials/crypto';
import { getStoredCredential, saveCredential } from '../workers/src/services/aiCredentials/repository';
import { rotateCredentialBatch } from '../workers/src/services/aiCredentials/rotation';
import { createSqliteD1 } from './helpers/sqliteD1';

const migrationPath = 'workers/migrations/0083_teacher_ai_credentials.sql';

const encodedKey = (seed: number) => {
  const bytes = new Uint8Array(32);
  bytes.forEach((_, index) => { bytes[index] = (seed + index) % 256; });
  return btoa(String.fromCharCode(...bytes));
};

const keyringV1 = JSON.stringify({ activeKeyId: 'v1', keys: { v1: encodedKey(3) } });
const keyringV2 = JSON.stringify({
  activeKeyId: 'v2',
  keys: { v1: encodedKey(3), v2: encodedKey(83) },
});
const keyringMissingOld = JSON.stringify({ activeKeyId: 'v2', keys: { v2: encodedKey(83) } });

let sqlite: DatabaseSync | null = null;

const setup = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
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
      audience TEXT NOT NULL DEFAULT 'all',
      percentage INTEGER NOT NULL DEFAULT 100,
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
    INSERT INTO teachers (username, name) VALUES ('teacher-a', 'A'), ('teacher-b', 'B');
  `);
  sqlite.exec(readFileSync(migrationPath, 'utf8'));
  return { sqlite, db: createSqliteD1(sqlite) };
};

const seed = async (
  db: D1Database,
  owner: string,
  provider: 'gemini' | 'deepseek',
  plaintext: string,
) => {
  const cipher = await encryptCredential(keyringV1, owner, provider, plaintext);
  return saveCredential(db, owner, provider, cipher, plaintext.slice(-4), 0);
};

afterEach(() => {
  sqlite?.close();
  sqlite = null;
});

describe('teacher AI credential key rotation', () => {
  it('re-encrypts an old row with the active key and keeps it decryptable', async () => {
    const { db } = setup();
    await seed(db, 'teacher-a', 'gemini', 'gemini-secret-rotation-1234');

    const result = await rotateCredentialBatch(db, keyringV2, null, 50);

    expect(result).toEqual({ nextCursor: null, rotated: 1, conflicted: 0 });
    const stored = await getStoredCredential(db, 'teacher-a', 'gemini');
    expect(stored?.cipher.keyId).toBe('v2');
    expect(stored?.version).toBe(2);
    await expect(decryptCredential(keyringV2, 'teacher-a', 'gemini', stored!.cipher))
      .resolves.toBe('gemini-secret-rotation-1234');
  });

  it('uses an opaque cursor so a restarted batch continues without rotating the same row twice', async () => {
    const { db } = setup();
    await seed(db, 'teacher-a', 'gemini', 'gemini-secret-rotation-1234');
    await seed(db, 'teacher-b', 'deepseek', 'deepseek-secret-rotation-5678');

    const first = await rotateCredentialBatch(db, keyringV2, null, 1);
    expect(first.rotated).toBe(1);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await rotateCredentialBatch(db, keyringV2, first.nextCursor, 1);
    expect(second).toEqual({ nextCursor: null, rotated: 1, conflicted: 0 });

    expect((await getStoredCredential(db, 'teacher-a', 'gemini'))?.cipher.keyId).toBe('v2');
    expect((await getStoredCredential(db, 'teacher-b', 'deepseek'))?.cipher.keyId).toBe('v2');
  });

  it('does not overwrite a concurrent credential update', async () => {
    const { sqlite: database, db: baseDb } = setup();
    await seed(baseDb, 'teacher-a', 'gemini', 'gemini-secret-rotation-1234');

    let injected = false;
    const db = {
      ...baseDb,
      prepare(sql: string) {
        const statement = baseDb.prepare(sql);
        if (!/UPDATE\s+teacher_ai_credentials\s+SET\s+ciphertext/i.test(sql)) return statement;
        return {
          bind(...values: unknown[]) {
            const bound = statement.bind(...values);
            return {
              ...bound,
              async first<T>() {
                if (!injected) {
                  injected = true;
                  database.prepare(`
                    UPDATE teacher_ai_credentials
                    SET version = version + 1, last4 = 'race', updated_at = datetime('now')
                    WHERE username = 'teacher-a' AND provider = 'gemini'
                  `).run();
                }
                return bound.first<T>();
              },
            };
          },
        } as unknown as D1PreparedStatement;
      },
    } as D1Database;

    const result = await rotateCredentialBatch(db, keyringV2, null, 50);

    expect(result).toEqual({ nextCursor: null, rotated: 0, conflicted: 1 });
    const row = database.prepare(`
      SELECT key_id, version, last4 FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'gemini'
    `).get();
    expect(row).toEqual({ key_id: 'v1', version: 2, last4: 'race' });
  });

  it('fails closed when the old key is missing and leaves the ciphertext untouched', async () => {
    const { sqlite: database, db } = setup();
    await seed(db, 'teacher-a', 'gemini', 'gemini-secret-rotation-1234');
    const before = database.prepare(`
      SELECT ciphertext, iv, key_id, version FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'gemini'
    `).get();

    await expect(rotateCredentialBatch(db, keyringMissingOld, null, 50))
      .rejects.toThrow('AI_VAULT_UNAVAILABLE');

    const after = database.prepare(`
      SELECT ciphertext, iv, key_id, version FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'gemini'
    `).get();
    expect(after).toEqual(before);
  });
});
