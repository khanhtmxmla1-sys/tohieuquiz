import type { AiCredentialCipher, PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';
import { decryptCredential, encryptCredential } from './crypto';

interface RotationRow {
  username: string;
  provider: PersonalAiProvider;
  ciphertext: string;
  iv: string;
  key_id: string;
  format_version: number;
  version: number;
}

interface RotationCursor {
  username: string;
  provider: PersonalAiProvider;
}

const vaultError = (): Error => new Error('AI_VAULT_UNAVAILABLE');

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw vaultError();
  }
};

const encodeCursor = (cursor: RotationCursor): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const decodeCursor = (raw: string | null): RotationCursor | null => {
  if (!raw) return null;
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
      + '='.repeat((4 - (raw.length % 4)) % 4);
    const decoded = new TextDecoder().decode(base64ToBytes(padded));
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const provider = parsed.provider;
    if (
      typeof parsed.username !== 'string'
      || (provider !== 'gemini' && provider !== 'deepseek')
    ) throw vaultError();
    return { username: parsed.username, provider };
  } catch {
    throw vaultError();
  }
};

const activeKeyId = (keyringRaw: string): string => {
  try {
    const parsed = JSON.parse(keyringRaw) as Record<string, unknown>;
    if (
      typeof parsed.activeKeyId !== 'string'
      || !parsed.activeKeyId
      || !parsed.keys
      || typeof parsed.keys !== 'object'
      || Array.isArray(parsed.keys)
      || typeof (parsed.keys as Record<string, unknown>)[parsed.activeKeyId] !== 'string'
    ) {
      throw vaultError();
    }
    return parsed.activeKeyId;
  } catch {
    throw vaultError();
  }
};

const loadBatch = async (
  db: D1Database,
  cursor: RotationCursor | null,
  limit: number,
): Promise<RotationRow[]> => {
  if (!cursor) {
    const rows = await db.prepare(`
      SELECT username, provider, ciphertext, iv, key_id, format_version, version
      FROM teacher_ai_credentials
      ORDER BY username, provider
      LIMIT ?
    `).bind(limit + 1).all<RotationRow>();
    return rows.results || [];
  }

  const rows = await db.prepare(`
    SELECT username, provider, ciphertext, iv, key_id, format_version, version
    FROM teacher_ai_credentials
    WHERE username > ?
       OR (username = ? AND provider > ?)
    ORDER BY username, provider
    LIMIT ?
  `).bind(cursor.username, cursor.username, cursor.provider, limit + 1).all<RotationRow>();
  return rows.results || [];
};

export async function rotateCredentialBatch(
  db: D1Database,
  keyring: string,
  cursorRaw: string | null,
  limitInput: number,
): Promise<{ nextCursor: string | null; rotated: number; conflicted: number }> {
  if (!Number.isFinite(limitInput) || limitInput < 1) {
    throw new Error('AI_ROTATION_LIMIT_INVALID');
  }
  const limit = Math.min(50, Math.floor(limitInput));
  const cursor = decodeCursor(cursorRaw);
  const targetKeyId = activeKeyId(keyring);
  const loadedRows = await loadBatch(db, cursor, limit);
  const hasMore = loadedRows.length > limit;
  const rows = loadedRows.slice(0, limit);

  let rotated = 0;
  let conflicted = 0;

  for (const row of rows) {
    if (row.key_id === targetKeyId) continue;
    if (Number(row.format_version) !== 1) throw vaultError();

    const oldCipher: AiCredentialCipher = {
      formatVersion: 1,
      keyId: row.key_id,
      iv: row.iv,
      ciphertext: row.ciphertext,
    };
    const plaintext = await decryptCredential(
      keyring,
      row.username,
      row.provider,
      oldCipher,
    );
    const nextCipher = await encryptCredential(
      keyring,
      row.username,
      row.provider,
      plaintext,
    );

    const updated = await db.prepare(`
      UPDATE teacher_ai_credentials
      SET ciphertext = ?,
          iv = ?,
          key_id = ?,
          format_version = 1,
          version = version + 1,
          updated_at = ?
      WHERE username = ?
        AND provider = ?
        AND version = ?
        AND key_id = ?
      RETURNING version
    `).bind(
      nextCipher.ciphertext,
      nextCipher.iv,
      nextCipher.keyId,
      new Date().toISOString(),
      row.username,
      row.provider,
      row.version,
      row.key_id,
    ).first<{ version: number }>();

    if (updated) rotated += 1;
    else conflicted += 1;
  }

  const last = rows.at(-1);
  return {
    nextCursor: hasMore && last
      ? encodeCursor({ username: last.username, provider: last.provider })
      : null,
    rotated,
    conflicted,
  };
}
