import type {
  AiCredentialCipher,
  AiCredentialSummary,
  PersonalAiProvider,
  QuizAiSource,
} from '../../../../shared/teacher-ai-credentials.contract';

export interface StoredAiCredential {
  provider: PersonalAiProvider;
  version: number;
  last4: string;
  verifiedAt: string;
  updatedAt: string;
  cipher: AiCredentialCipher;
}

export interface CredentialAuditRecord {
  id: string;
  owner: string;
  role: 'teacher' | 'admin';
  eventType: 'AI_KEY_SAVED' | 'AI_KEY_DELETED' | 'AI_KEY_TESTED';
  provider: PersonalAiProvider;
  operation: 'save' | 'test' | 'delete';
  resultCode: string;
  requestId: string;
  createdAt: string;
}

type CredentialRow = {
  provider: PersonalAiProvider;
  ciphertext: string;
  iv: string;
  key_id: string;
  format_version: number;
  last4: string;
  version: number;
  verified_at: string;
  updated_at: string;
};

export class AiCredentialRepositoryError extends Error {
  constructor(public readonly code: 'AI_KEY_VERSION_CONFLICT' | 'AI_VAULT_UNAVAILABLE') {
    super(code);
    this.name = 'AiCredentialRepositoryError';
  }
}

const summaryFromRow = (row: CredentialRow): AiCredentialSummary => ({
  provider: row.provider,
  configured: true,
  last4: row.last4,
  version: Number(row.version),
  verifiedAt: row.verified_at,
  updatedAt: row.updated_at,
});

const storedFromRow = (row: CredentialRow): StoredAiCredential => ({
  provider: row.provider,
  version: Number(row.version),
  last4: row.last4,
  verifiedAt: row.verified_at,
  updatedAt: row.updated_at,
  cipher: {
    formatVersion: 1,
    keyId: row.key_id,
    iv: row.iv,
    ciphertext: row.ciphertext,
  },
});

const selectCredential = async (
  db: D1Database,
  owner: string,
  provider: PersonalAiProvider,
): Promise<CredentialRow | null> => db.prepare(`
  SELECT
    provider, ciphertext, iv, key_id, format_version, last4, version,
    verified_at, updated_at
  FROM teacher_ai_credentials
  WHERE username = ? AND provider = ?
  LIMIT 1
`).bind(owner, provider).first<CredentialRow>();

export async function getStoredCredential(
  db: D1Database,
  owner: string,
  provider: PersonalAiProvider,
): Promise<StoredAiCredential | null> {
  const row = await selectCredential(db, owner, provider);
  if (!row) return null;
  if (Number(row.format_version) !== 1) {
    throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
  }
  return storedFromRow(row);
}

export async function listCredentialSummaries(
  db: D1Database,
  owner: string,
): Promise<AiCredentialSummary[]> {
  const rows = await db.prepare(`
    SELECT
      provider, ciphertext, iv, key_id, format_version, last4, version,
      verified_at, updated_at
    FROM teacher_ai_credentials
    WHERE username = ?
    ORDER BY provider
  `).bind(owner).all<CredentialRow>();
  return (rows.results || []).map(summaryFromRow);
}

export async function getAiDefaultSource(
  db: D1Database,
  owner: string,
): Promise<QuizAiSource> {
  const row = await db.prepare(`
    SELECT default_source
    FROM teacher_ai_preferences
    WHERE username = ?
    LIMIT 1
  `).bind(owner).first<{ default_source: QuizAiSource }>();
  return row?.default_source ?? 'system';
}

export async function saveAiDefaultSource(
  db: D1Database,
  owner: string,
  source: QuizAiSource,
  now = new Date(),
): Promise<QuizAiSource> {
  const result = await db.prepare(`
    INSERT INTO teacher_ai_preferences (username, default_source, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      default_source = excluded.default_source,
      updated_at = excluded.updated_at
  `).bind(owner, source, now.toISOString()).run();
  if (changesFrom(result) !== 1) {
    throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
  }
  return source;
}

const changesFrom = (result: D1Result<unknown>): number => (
  Number((result as D1Result<unknown> & { changes?: number }).meta?.changes
    ?? (result as D1Result<unknown> & { changes?: number }).changes
    ?? 0)
);

const auditValues = (audit: CredentialAuditRecord): unknown[] => [
  audit.id,
  audit.owner,
  audit.role,
  audit.eventType,
  audit.provider,
  audit.operation,
  audit.resultCode,
  audit.requestId,
  audit.createdAt,
];

const prepareAuditInsert = (
  db: D1Database,
  audit: CredentialAuditRecord,
  credentialPredicate: string,
  predicateValues: unknown[],
): D1PreparedStatement => db.prepare(`
  INSERT INTO teacher_ai_credential_audit (
    id, username, role, event_type, provider, operation,
    result_code, request_id, created_at
  )
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
  WHERE EXISTS (
    SELECT 1 FROM teacher_ai_credentials
    WHERE ${credentialPredicate}
  )
`).bind(...auditValues(audit), ...predicateValues);

export async function insertCredentialAudit(
  db: D1Database,
  audit: CredentialAuditRecord,
): Promise<void> {
  const result = await db.prepare(`
    INSERT INTO teacher_ai_credential_audit (
      id, username, role, event_type, provider, operation,
      result_code, request_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(...auditValues(audit)).run();
  if (changesFrom(result) !== 1) {
    throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
  }
}

export async function saveCredential(
  db: D1Database,
  owner: string,
  provider: PersonalAiProvider,
  cipher: AiCredentialCipher,
  last4: string,
  expectedVersion: number,
  now = new Date(),
  audit?: CredentialAuditRecord,
): Promise<AiCredentialSummary> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
  }
  const timestamp = now.toISOString();

  if (expectedVersion === 0) {
    try {
      const mutation = db.prepare(`
        INSERT INTO teacher_ai_credentials (
          username, provider, ciphertext, iv, key_id, format_version, last4,
          version, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)
      `).bind(
        owner,
        provider,
        cipher.ciphertext,
        cipher.iv,
        cipher.keyId,
        last4,
        timestamp,
        timestamp,
        timestamp,
      );
      const results = audit
        ? await db.batch([
          mutation,
          prepareAuditInsert(
            db,
            audit,
            'username = ? AND provider = ? AND version = 1 AND ciphertext = ? AND iv = ? AND key_id = ?',
            [owner, provider, cipher.ciphertext, cipher.iv, cipher.keyId],
          ),
        ])
        : [await mutation.run()];
      if (changesFrom(results[0]) !== 1 || (audit && changesFrom(results[1]) !== 1)) {
        throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
      }
    } catch (error) {
      if (error instanceof AiCredentialRepositoryError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (/unique|constraint|primary key/i.test(message)) {
        throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
      }
      throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
    }
  } else {
    const mutation = db.prepare(`
      UPDATE teacher_ai_credentials
      SET ciphertext = ?,
          iv = ?,
          key_id = ?,
          format_version = 1,
          last4 = ?,
          version = version + 1,
          verified_at = ?,
          updated_at = ?
      WHERE username = ?
        AND provider = ?
        AND version = ?
    `).bind(
      cipher.ciphertext,
      cipher.iv,
      cipher.keyId,
      last4,
      timestamp,
      timestamp,
      owner,
      provider,
      expectedVersion,
    );
    const results = audit
      ? await db.batch([
        mutation,
        prepareAuditInsert(
          db,
          audit,
          'username = ? AND provider = ? AND version = ? AND ciphertext = ? AND iv = ? AND key_id = ?',
          [owner, provider, expectedVersion + 1, cipher.ciphertext, cipher.iv, cipher.keyId],
        ),
      ])
      : [await mutation.run()];
    if (changesFrom(results[0]) !== 1 || (audit && changesFrom(results[1]) !== 1)) {
      throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
    }
  }

  const row = await selectCredential(db, owner, provider);
  if (!row) throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
  return summaryFromRow(row);
}

export async function markCredentialVerified(
  db: D1Database,
  owner: string,
  provider: PersonalAiProvider,
  expectedVersion: number,
  now = new Date(),
  audit?: CredentialAuditRecord,
): Promise<AiCredentialSummary> {
  const timestamp = now.toISOString();
  const mutation = db.prepare(`
    UPDATE teacher_ai_credentials
    SET verified_at = ?, updated_at = ?
    WHERE username = ? AND provider = ? AND version = ?
  `).bind(timestamp, timestamp, owner, provider, expectedVersion);
  const results = audit
    ? await db.batch([
      mutation,
      prepareAuditInsert(
        db,
        audit,
        'username = ? AND provider = ? AND version = ? AND verified_at = ?',
        [owner, provider, expectedVersion, timestamp],
      ),
    ])
    : [await mutation.run()];
  if (changesFrom(results[0]) !== 1 || (audit && changesFrom(results[1]) !== 1)) {
    throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
  }
  const row = await selectCredential(db, owner, provider);
  if (!row) throw new AiCredentialRepositoryError('AI_VAULT_UNAVAILABLE');
  return summaryFromRow(row);
}

export async function deleteCredential(
  db: D1Database,
  owner: string,
  provider: PersonalAiProvider,
  expectedVersion: number,
  audit?: CredentialAuditRecord,
): Promise<boolean> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
  }

  const mutation = db.prepare(`
    DELETE FROM teacher_ai_credentials
    WHERE username = ? AND provider = ? AND version = ?
  `).bind(owner, provider, expectedVersion);
  const results = audit
    ? await db.batch([
      prepareAuditInsert(
        db,
        audit,
        'username = ? AND provider = ? AND version = ?',
        [owner, provider, expectedVersion],
      ),
      mutation,
    ])
    : [await mutation.run()];
  const mutationResult = audit ? results[1] : results[0];
  if (changesFrom(mutationResult) === 1 && (!audit || changesFrom(results[0]) === 1)) return true;

  const current = await selectCredential(db, owner, provider);
  if (current) {
    throw new AiCredentialRepositoryError('AI_KEY_VERSION_CONFLICT');
  }
  return false;
}
