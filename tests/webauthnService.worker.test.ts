// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WEBAUTHN_PRODUCTION_ORIGINS,
  WEBAUTHN_RP_ID,
  allowedWebAuthnOrigins,
  beginPasskeyAuthentication,
  beginPasskeyRegistration,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  hashWebAuthnChallenge,
  verifyAuthenticationWithPinnedLibrary,
  type WebAuthnVerifierAdapter,
} from '../workers/src/services/webauthnService';

class SqliteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return (this.statement.get(...this.bindings) ?? null) as T | null; }
  async all<T>() { return { results: this.statement.all(...this.bindings) as T[] }; }
  async run() {
    const result = this.statement.run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new SqliteStatement(this.sqlite.prepare(sql)); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

const migration = readFileSync(new URL('../workers/migrations/0053_webauthn_passkeys.sql', import.meta.url), 'utf8');
let sqlite: DatabaseSync | null = null;
afterEach(() => { sqlite?.close(); sqlite = null; });

const setup = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE security_events (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'informational',
      actor_username TEXT,
      session_id TEXT,
      request_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);
  sqlite.exec(migration);
  return new SqliteD1(sqlite) as unknown as D1Database;
};
const identity = { username: 'teacher-a', role: 'teacher' as const, fullName: 'Teacher A' };
const env = { ENVIRONMENT: 'production' } as any;
const response = { id: 'cred-1', rawId: 'cred-1', type: 'public-key', response: {} } as any;

const verifier = (registrationChallenge: string, authenticationChallenges: string[] = []): WebAuthnVerifierAdapter => ({
  verifyRegistration: vi.fn(async (options: any) => {
    expect(await options.expectedChallenge(registrationChallenge)).toBe(true);
    expect(options.expectedOrigin).toEqual([...WEBAUTHN_PRODUCTION_ORIGINS]);
    expect(options.expectedRPID).toBe(WEBAUTHN_RP_ID);
    return {
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    } as any;
  }),
  verifyAuthentication: vi.fn(async (options: any) => {
    const expected = authenticationChallenges.shift();
    expect(await options.expectedChallenge(expected)).toBe(true);
    return { verified: true, authenticationInfo: { newCounter: 1 } } as any;
  }),
});

describe('WebAuthn passkey lifecycle', () => {
  it('uses the fixed RP ID and exact production origins', () => {
    expect(WEBAUTHN_RP_ID).toBe('thtohieu.com');
    expect(allowedWebAuthnOrigins({ ENVIRONMENT: 'production' } as any))
      .toEqual(['https://thtohieu.com', 'https://www.thtohieu.com']);
  });

  it('stores only a challenge hash and consumes a registration challenge once', async () => {
    const db = setup();
    const started = await beginPasskeyRegistration(db, identity, 'req-register-options');
    const row = sqlite!.prepare('SELECT challenge_hash, consumed_at FROM webauthn_challenges WHERE id=?')
      .get(started.challengeId) as { challenge_hash: string; consumed_at: string | null };
    expect(row.challenge_hash).toBe(await hashWebAuthnChallenge(started.options.challenge));
    expect(row.challenge_hash).not.toContain(started.options.challenge);

    const adapter = verifier(started.options.challenge);
    await expect(finishPasskeyRegistration(db, env, identity, {
      challengeId: started.challengeId, response, label: 'Laptop',
    }, 'req-register-verify', adapter)).resolves.toMatchObject({ id: 'cred-1', label: 'Laptop' });
    await expect(finishPasskeyRegistration(db, env, identity, {
      challengeId: started.challengeId, response,
    }, 'req-register-replay', adapter)).rejects.toThrow('WEBAUTHN_CHALLENGE_INVALID');
    expect(sqlite!.prepare("SELECT COUNT(*) AS count FROM security_events WHERE event_type='PASSKEY_ADDED'").get())
      .toEqual({ count: 1 });
  });

  it('rejects a cloned or replayed signature counter across separate challenges', async () => {
    const db = setup();
    const registration = await beginPasskeyRegistration(db, identity, 'req-register');
    await finishPasskeyRegistration(db, env, identity, {
      challengeId: registration.challengeId, response,
    }, 'req-register-finish', verifier(registration.options.challenge));

    const first = await beginPasskeyAuthentication(db, identity, 'req-auth-1');
    const second = await beginPasskeyAuthentication(db, identity, 'req-auth-2');
    const authVerifier = verifier('', [first.options.challenge, second.options.challenge]);
    await finishPasskeyAuthentication(db, env, identity, {
      challengeId: first.challengeId, response,
    }, authVerifier);
    await expect(finishPasskeyAuthentication(db, env, identity, {
      challengeId: second.challengeId, response,
    }, authVerifier)).rejects.toThrow('WEBAUTHN_COUNTER_REPLAYED');
  });

  it('delegates wrong-origin and wrong-RP-ID rejection to the pinned library', async () => {
    const b64url = (value: Uint8Array | string) => Buffer.from(value).toString('base64url');
    const clientData = (origin: string) => b64url(JSON.stringify({
      type: 'webauthn.get', challenge: 'challenge-a', origin,
    }));
    const baseResponse = {
      id: 'cred-1', rawId: 'cred-1', type: 'public-key',
      clientExtensionResults: {}, authenticatorAttachment: 'platform',
      response: { clientDataJSON: clientData('https://evil.example'), authenticatorData: 'AA', signature: 'AA', userHandle: null },
    } as any;
    await expect(verifyAuthenticationWithPinnedLibrary({
      response: baseResponse,
      expectedChallenge: 'challenge-a',
      expectedOrigin: [...WEBAUTHN_PRODUCTION_ORIGINS],
      expectedRPID: WEBAUTHN_RP_ID,
      credential: { id: 'cred-1', publicKey: new Uint8Array([1]), counter: 0 },
      requireUserVerification: true,
    })).rejects.toThrow(/origin/i);

    const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('evil.example')));
    const authenticatorData = new Uint8Array(37);
    authenticatorData.set(rpHash, 0);
    authenticatorData[32] = 0x05;
    const wrongRpResponse = {
      ...baseResponse,
      response: {
        ...baseResponse.response,
        clientDataJSON: clientData('https://thtohieu.com'),
        authenticatorData: b64url(authenticatorData),
      },
    };
    await expect(verifyAuthenticationWithPinnedLibrary({
      response: wrongRpResponse,
      expectedChallenge: 'challenge-a',
      expectedOrigin: [...WEBAUTHN_PRODUCTION_ORIGINS],
      expectedRPID: WEBAUTHN_RP_ID,
      credential: { id: 'cred-1', publicKey: new Uint8Array([1]), counter: 0 },
      requireUserVerification: true,
    })).rejects.toThrow(/rp id|rpID|relying party/i);
  });
});
