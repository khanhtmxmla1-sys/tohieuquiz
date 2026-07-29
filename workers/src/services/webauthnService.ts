import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import type { Env } from '../types';
import type { SecurityEventType } from './authSessionService';
import { recordSecurityEvent } from './authSessionService';

export const WEBAUTHN_RP_ID = 'thtohieu.com';
export const WEBAUTHN_RP_NAME = 'TôHiệuQuiz';
export const WEBAUTHN_PRODUCTION_ORIGINS = [
  'https://thtohieu.com',
  'https://www.thtohieu.com',
] as const;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface WebAuthnVerifierAdapter {
  verifyRegistration: typeof verifyRegistrationResponse;
  verifyAuthentication: typeof verifyAuthenticationResponse;
}

const defaultVerifier: WebAuthnVerifierAdapter = {
  verifyRegistration: verifyRegistrationResponse,
  verifyAuthentication: verifyAuthenticationResponse,
};

export const verifyAuthenticationWithPinnedLibrary = (
  options: Parameters<typeof verifyAuthenticationResponse>[0],
) => verifyAuthenticationResponse(options);

interface StaffIdentity {
  username: string;
  role: 'teacher' | 'admin';
  fullName: string;
}

interface CredentialRow {
  credential_id: string;
  username: string;
  role: 'teacher' | 'admin';
  public_key: ArrayBuffer | Uint8Array;
  counter: number;
  transports_json: string;
  device_type: string;
  backed_up: number;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ChallengeRow {
  id: string;
  username: string;
  role: 'teacher' | 'admin';
  purpose: 'registration' | 'authentication';
  challenge_hash: string;
  expires_at: string;
  consumed_at: string | null;
}

const safeText = (value: unknown, max = 128): string => (
  String(value ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max)
);

const parseJson = <T>(value: string, fallback: T): T => {
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

const toHex = (bytes: Uint8Array): string => (
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
);

export async function hashWebAuthnChallenge(challenge: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(challenge));
  return toHex(new Uint8Array(digest));
}

export function allowedWebAuthnOrigins(env: Pick<Env, 'ENVIRONMENT' | 'WEBAUTHN_ALLOWED_ORIGINS'>): string[] {
  if (env.ENVIRONMENT === 'production') return [...WEBAUTHN_PRODUCTION_ORIGINS];
  const configured = String(env.WEBAUTHN_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : [...WEBAUTHN_PRODUCTION_ORIGINS];
}

async function storeChallenge(
  db: D1Database,
  identity: Pick<StaffIdentity, 'username' | 'role'>,
  purpose: ChallengeRow['purpose'],
  challenge: string,
  requestId: string,
  now = new Date(),
): Promise<string> {
  const id = `webauthn-challenge-${crypto.randomUUID()}`;
  await db.prepare(`
    INSERT INTO webauthn_challenges (
      id, username, role, purpose, challenge_hash, request_id,
      created_at, expires_at, consumed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).bind(
    id,
    identity.username,
    identity.role,
    purpose,
    await hashWebAuthnChallenge(challenge),
    safeText(requestId, 128),
    now.toISOString(),
    new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(),
  ).run();
  return id;
}

async function loadChallenge(
  db: D1Database,
  challengeId: string,
  identity: Pick<StaffIdentity, 'username' | 'role'>,
  purpose: ChallengeRow['purpose'],
  now = new Date(),
): Promise<ChallengeRow> {
  const row = await db.prepare(`
    SELECT id, username, role, purpose, challenge_hash, expires_at, consumed_at
    FROM webauthn_challenges
    WHERE id = ? AND username = ? AND role = ? AND purpose = ?
      AND consumed_at IS NULL AND expires_at > ?
    LIMIT 1
  `).bind(
    safeText(challengeId, 160), identity.username, identity.role, purpose, now.toISOString(),
  ).first<ChallengeRow>();
  if (!row) throw new Error('WEBAUTHN_CHALLENGE_INVALID');
  return row;
}

async function consumeChallenge(
  db: D1Database,
  challenge: ChallengeRow,
  now = new Date(),
): Promise<void> {
  const result = await db.prepare(`
    UPDATE webauthn_challenges
    SET consumed_at = ?
    WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
  `).bind(now.toISOString(), challenge.id, now.toISOString()).run();
  if (Number(result.meta?.changes || 0) !== 1) throw new Error('WEBAUTHN_CHALLENGE_REPLAYED');
}

async function challengeVerifier(row: ChallengeRow, presented: string): Promise<boolean> {
  const actual = await hashWebAuthnChallenge(presented);
  return actual === row.challenge_hash;
}

const transports = (row: CredentialRow): AuthenticatorTransportFuture[] => (
  parseJson<AuthenticatorTransportFuture[]>(row.transports_json, [])
);

const credentialPublicKey = (value: ArrayBuffer | Uint8Array): Uint8Array => (
  value instanceof Uint8Array ? value : new Uint8Array(value)
);

const toWebAuthnCredential = (row: CredentialRow): WebAuthnCredential => ({
  id: row.credential_id,
  publicKey: credentialPublicKey(row.public_key),
  counter: Number(row.counter || 0),
  transports: transports(row),
});

async function activeCredentials(db: D1Database, identity: Pick<StaffIdentity, 'username' | 'role'>): Promise<CredentialRow[]> {
  const rows = await db.prepare(`
    SELECT credential_id, username, role, public_key, counter, transports_json,
           device_type, backed_up, label, created_at, last_used_at, revoked_at
    FROM webauthn_credentials
    WHERE username = ? AND role = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(identity.username, identity.role).all<CredentialRow>();
  return rows.results || [];
}

export async function beginPasskeyRegistration(
  db: D1Database,
  identity: StaffIdentity,
  requestId: string,
): Promise<{ challengeId: string; options: Awaited<ReturnType<typeof generateRegistrationOptions>> }> {
  const credentials = await activeCredentials(db, identity);
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_RP_NAME,
    rpID: WEBAUTHN_RP_ID,
    userName: identity.username,
    userDisplayName: identity.fullName,
    userID: new TextEncoder().encode(identity.username),
    timeout: CHALLENGE_TTL_MS,
    attestationType: 'none',
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
      transports: transports(credential),
    })),
  });
  const challengeId = await storeChallenge(db, identity, 'registration', options.challenge, requestId);
  return { challengeId, options };
}

export async function finishPasskeyRegistration(
  db: D1Database,
  env: Env,
  identity: StaffIdentity,
  input: { challengeId: string; response: RegistrationResponseJSON; label?: string },
  requestId: string,
  verifier: WebAuthnVerifierAdapter = defaultVerifier,
): Promise<{ id: string; label: string; createdAt: string }> {
  const challenge = await loadChallenge(db, input.challengeId, identity, 'registration');
  const verification = await verifier.verifyRegistration({
    response: input.response,
    expectedChallenge: (presented) => challengeVerifier(challenge, presented),
    expectedOrigin: allowedWebAuthnOrigins(env),
    expectedRPID: WEBAUTHN_RP_ID,
    requireUserVerification: true,
    supportedAlgorithmIDs: [-7, -257],
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('WEBAUTHN_REGISTRATION_REJECTED');
  }
  await consumeChallenge(db, challenge);
  const info = verification.registrationInfo;
  const now = new Date().toISOString();
  const label = safeText(input.label || 'Passkey', 80) || 'Passkey';
  await db.prepare(`
    INSERT INTO webauthn_credentials (
      credential_id, username, role, public_key, counter, transports_json,
      device_type, backed_up, label, created_at, last_used_at, revoked_at, revoked_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
  `).bind(
    info.credential.id,
    identity.username,
    identity.role,
    info.credential.publicKey,
    info.credential.counter,
    JSON.stringify(info.credential.transports || []),
    info.credentialDeviceType,
    info.credentialBackedUp ? 1 : 0,
    label,
    now,
  ).run();
  await recordSecurityEvent(db, {
    username: identity.username,
    role: identity.role,
    eventType: 'PASSKEY_ADDED' as SecurityEventType,
    actorUsername: identity.username,
    requestId,
    metadata: { credentialIdSuffix: info.credential.id.slice(-8), label },
  });
  return { id: info.credential.id, label, createdAt: now };
}

export async function beginPasskeyAuthentication(
  db: D1Database,
  identity: StaffIdentity,
  requestId: string,
): Promise<{ challengeId: string; options: Awaited<ReturnType<typeof generateAuthenticationOptions>> }> {
  const credentials = await activeCredentials(db, identity);
  if (credentials.length === 0) throw new Error('WEBAUTHN_NOT_AVAILABLE');
  const options = await generateAuthenticationOptions({
    rpID: WEBAUTHN_RP_ID,
    timeout: CHALLENGE_TTL_MS,
    userVerification: 'required',
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
      transports: transports(credential),
    })),
  });
  const challengeId = await storeChallenge(db, identity, 'authentication', options.challenge, requestId);
  return { challengeId, options };
}

export async function finishPasskeyAuthentication(
  db: D1Database,
  env: Env,
  identity: StaffIdentity,
  input: { challengeId: string; response: AuthenticationResponseJSON },
  verifier: WebAuthnVerifierAdapter = defaultVerifier,
): Promise<void> {
  const challenge = await loadChallenge(db, input.challengeId, identity, 'authentication');
  const credential = await db.prepare(`
    SELECT credential_id, username, role, public_key, counter, transports_json,
           device_type, backed_up, label, created_at, last_used_at, revoked_at
    FROM webauthn_credentials
    WHERE credential_id = ? AND username = ? AND role = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(input.response.id, identity.username, identity.role).first<CredentialRow>();
  if (!credential) throw new Error('WEBAUTHN_AUTHENTICATION_REJECTED');
  const verification = await verifier.verifyAuthentication({
    response: input.response,
    expectedChallenge: (presented) => challengeVerifier(challenge, presented),
    expectedOrigin: allowedWebAuthnOrigins(env),
    expectedRPID: WEBAUTHN_RP_ID,
    credential: toWebAuthnCredential(credential),
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('WEBAUTHN_AUTHENTICATION_REJECTED');
  const newCounter = verification.authenticationInfo.newCounter;
  if (newCounter !== 0 && newCounter <= credential.counter) {
    throw new Error('WEBAUTHN_COUNTER_REPLAYED');
  }
  await consumeChallenge(db, challenge);
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE webauthn_credentials
    SET counter = ?, last_used_at = ?
    WHERE credential_id = ? AND counter = ? AND revoked_at IS NULL
  `).bind(
    newCounter,
    now,
    credential.credential_id,
    credential.counter,
  ).run();
  if (Number(result.meta?.changes || 0) !== 1) throw new Error('WEBAUTHN_COUNTER_REPLAYED');
}

export async function listPasskeys(
  db: D1Database,
  identity: Pick<StaffIdentity, 'username' | 'role'>,
): Promise<Array<{ id: string; label: string; deviceType: string; backedUp: boolean; createdAt: string; lastUsedAt: string | null }>> {
  const rows = await activeCredentials(db, identity);
  return rows.map((row) => ({
    id: row.credential_id,
    label: row.label,
    deviceType: row.device_type,
    backedUp: row.backed_up === 1,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function revokePasskey(
  db: D1Database,
  identity: Pick<StaffIdentity, 'username' | 'role'>,
  credentialId: string,
  requestId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE webauthn_credentials
    SET revoked_at = ?, revoked_by = ?
    WHERE credential_id = ? AND username = ? AND role = ? AND revoked_at IS NULL
  `).bind(now, identity.username, safeText(credentialId, 1024), identity.username, identity.role).run();
  const changed = Number(result.meta?.changes || 0) === 1;
  if (changed) {
    await recordSecurityEvent(db, {
      username: identity.username,
      role: identity.role,
      eventType: 'PASSKEY_REMOVED' as SecurityEventType,
      actorUsername: identity.username,
      requestId,
      metadata: { credentialIdSuffix: safeText(credentialId, 1024).slice(-8) },
    });
  }
  return changed;
}

export async function purgeExpiredWebAuthnChallenges(db: D1Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare('DELETE FROM webauthn_challenges WHERE created_at < ?').bind(cutoff).run();
  return Number(result.meta?.changes || 0);
}
