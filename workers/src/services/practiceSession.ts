import { jwtVerify, SignJWT } from 'jose';
import {
  PRACTICE_DELIVERY_VERSION,
  PRACTICE_MAX_SELECTED_QUESTIONS,
  PRACTICE_MAX_SESSION_TOKEN_BYTES,
  PRACTICE_SESSION_AUDIENCE,
  PRACTICE_SESSION_ISSUER,
  PRACTICE_SESSION_PURPOSE,
  PRACTICE_SESSION_TTL_SECONDS,
  type PracticeSessionClaims,
  type PracticeSessionEnvelope,
  type PracticeSessionQuestionReference,
  utf8ByteLength,
} from '../../../shared/practice-grading.contract';
import type { StudentQuizQuestionDtoContext } from './studentQuizQuestionDto';

const TEXT_ENCODER = new TextEncoder();
const PRACTICE_SIGNING_KEY_CONTEXT = 'tohieuquiz-public-practice-signing-key-v1';
const PRACTICE_FINGERPRINT_KEY_CONTEXT = 'tohieuquiz-public-practice-question-fingerprint-v1';
const PRACTICE_DTO_KEY_CONTEXT = 'tohieuquiz-public-practice-question-dto-key-v1';
const MAX_SECRET_BYTES = 16 * 1024;
const MAX_ID_LENGTH = 256;
const MAX_CLOCK_SKEW_SECONDS = 60;

export class PracticeSessionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PracticeSessionError';
  }
}

export interface SignPracticeSessionInput {
  jwtSecret: string;
  sessionId: string;
  practiceId: string;
  selected: readonly PracticeSessionQuestionReference[];
  now?: Date | number;
  ttlSeconds?: number;
}

export interface VerifyPracticeSessionOptions {
  jwtSecret: string;
  now?: Date | number;
}

export interface PracticeDtoContextInput {
  jwtSecret: string;
  sessionId: string;
  quizId: string;
  revision: number;
}

const asSecret = (secret: string): string => {
  if (typeof secret !== 'string' || secret.trim().length === 0 || utf8ByteLength(secret) > MAX_SECRET_BYTES) {
    throw new PracticeSessionError('PRACTICE_SECRET_INVALID', 'Practice signing secret is unavailable.', 503);
  }
  return secret;
};

const asDate = (value: Date | number | undefined): Date => {
  const date = value === undefined
    ? new Date()
    : value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new PracticeSessionError('PRACTICE_TIME_INVALID', 'Practice session time is invalid.');
  }
  return date;
};

const epochSeconds = (value: Date | number | undefined): number => Math.floor(asDate(value).getTime() / 1000);

const isBoundedId = (value: unknown): value is string => (
  typeof value === 'string'
  && value.trim().length > 0
  && value.length <= MAX_ID_LENGTH
  && utf8ByteLength(value) <= MAX_ID_LENGTH
  && !/[\u0000-\u001f\u007f]/.test(value)
);

const isValidRevision = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isValidFingerprint = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length === 64
  && /^[a-f0-9]{64}$/i.test(value)
);

const isReference = (value: unknown): value is PracticeSessionQuestionReference => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (keys.length !== 4 || keys.join('|') !== 'fingerprint|questionId|quizId|revision') return false;
  return isBoundedId(candidate.questionId)
    && isBoundedId(candidate.quizId)
    && isValidRevision(candidate.revision)
    && isValidFingerprint(candidate.fingerprint);
};

const validateReferences = (
  input: unknown,
): PracticeSessionQuestionReference[] | null => {
  if (!Array.isArray(input)
    || input.length < 1
    || input.length > PRACTICE_MAX_SELECTED_QUESTIONS) return null;
  const references = input.filter(isReference).map((value) => {
    const reference = value as PracticeSessionQuestionReference;
    return {
      questionId: reference.questionId,
      quizId: reference.quizId,
      revision: reference.revision,
      fingerprint: reference.fingerprint,
    };
  });
  if (references.length !== input.length) return null;
  const ids = new Set(references.map((reference) => reference.questionId));
  return ids.size === references.length ? references : null;
};

const keyFromSecret = async (secret: string, context: string): Promise<Uint8Array> => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', baseKey, TEXT_ENCODER.encode(context));
  return new Uint8Array(signature);
};

const hmac = async (key: Uint8Array, message: string): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, TEXT_ENCODER.encode(message));
  return new Uint8Array(signature);
};

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const practiceSigningKey = (secret: string): Promise<Uint8Array> => {
  const signingContext = PRACTICE_SIGNING_KEY_CONTEXT;
  return keyFromSecret(secret, signingContext);
};

/**
 * Exposed for Worker-level contract tests and controlled signing adapters.
 * Callers should pass the resulting key only to jose; never persist or log it.
 */
export const derivePracticeSessionSigningKey = async (jwtSecret: string): Promise<Uint8Array> => (
  practiceSigningKey(asSecret(jwtSecret))
);

const normalizeId = (value: unknown, code: string): string => {
  if (!isBoundedId(value)) throw new PracticeSessionError(code, 'Practice session identifier is invalid.');
  return value;
};

const canonicalJson = (value: unknown, seen = new Set<object>()): string => {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PracticeSessionError('PRACTICE_ROW_INVALID', 'Question row contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (typeof value === 'undefined') return 'null';
  if (typeof value !== 'object') throw new PracticeSessionError('PRACTICE_ROW_INVALID', 'Question row contains an unsupported value.');
  if (seen.has(value)) throw new PracticeSessionError('PRACTICE_ROW_INVALID', 'Question row contains a cycle.');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item, seen)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
};

/** Stable, sorted-key serialization used as the HMAC message. */
export const canonicalizePracticeQuestionRow = (row: unknown): string => canonicalJson(row);

/** Fingerprint an answer-bearing source row with a keyed, domain-separated HMAC. */
export async function fingerprintPracticeQuestionRow(row: unknown, jwtSecret: string): Promise<string> {
  const validatedSecret = asSecret(jwtSecret);
  const key = await keyFromSecret(validatedSecret, PRACTICE_FINGERPRINT_KEY_CONTEXT);
  return hex(await hmac(key, `${PRACTICE_FINGERPRINT_KEY_CONTEXT}\u0000${canonicalizePracticeQuestionRow(row)}`));
}

const normalizeSelected = (
  input: SignPracticeSessionInput,
): PracticeSessionQuestionReference[] => {
  const references = validateReferences(input.selected);
  if (!references) {
    throw new PracticeSessionError(
      'PRACTICE_SELECTION_INVALID',
      `Practice sessions require 1-${PRACTICE_MAX_SELECTED_QUESTIONS} unique selected questions.`,
    );
  }
  return references;
};

const toClaims = (
  input: SignPracticeSessionInput,
  iat: number,
  exp: number,
): PracticeSessionClaims => {
  const sessionId = normalizeId(input.sessionId, 'PRACTICE_SESSION_ID_INVALID');
  const practiceId = normalizeId(
    input.practiceId,
    'PRACTICE_ID_INVALID',
  );
  const selected = normalizeSelected(input);
  return {
    iss: PRACTICE_SESSION_ISSUER,
    aud: PRACTICE_SESSION_AUDIENCE,
    purpose: PRACTICE_SESSION_PURPOSE,
    version: PRACTICE_DELIVERY_VERSION,
    iat,
    exp,
    sessionId,
    practiceId,
    selected,
  };
};

export async function signPracticeSession(input: SignPracticeSessionInput): Promise<PracticeSessionEnvelope> {
  const secret = asSecret(input.jwtSecret);
  const now = epochSeconds(input.now);
  const ttlSeconds = input.ttlSeconds ?? PRACTICE_SESSION_TTL_SECONDS;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > PRACTICE_SESSION_TTL_SECONDS) {
    throw new PracticeSessionError('PRACTICE_TTL_INVALID', 'Practice session TTL exceeds the allowed maximum.');
  }
  const exp = now + ttlSeconds;
  const claims = toClaims(input, now, exp);
  const key = await practiceSigningKey(secret);
  const token = await new SignJWT({
    version: claims.version,
    purpose: claims.purpose,
    sessionId: claims.sessionId,
    practiceId: claims.practiceId,
    selected: claims.selected,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(PRACTICE_SESSION_ISSUER)
    .setAudience(PRACTICE_SESSION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  const tokenBytes = utf8ByteLength(token);
  if (tokenBytes > PRACTICE_MAX_SESSION_TOKEN_BYTES) {
    throw new PracticeSessionError('PRACTICE_TOKEN_TOO_LARGE', 'Practice session token exceeds the size limit.');
  }
  return {
    version: PRACTICE_DELIVERY_VERSION,
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

const claimValue = (payload: Record<string, unknown>, key: string): unknown => payload[key];
const PRACTICE_CLAIM_KEYS = new Set([
  'iss', 'aud', 'iat', 'exp', 'version', 'purpose', 'sessionId', 'practiceId', 'selected',
]);

const validateClaims = (
  payload: Record<string, unknown>,
  now: number,
): PracticeSessionClaims | null => {
  if (Object.keys(payload).some((key) => !PRACTICE_CLAIM_KEYS.has(key))
    || claimValue(payload, 'version') !== PRACTICE_DELIVERY_VERSION
    || claimValue(payload, 'purpose') !== PRACTICE_SESSION_PURPOSE
    || !isBoundedId(claimValue(payload, 'sessionId'))
    || !isBoundedId(claimValue(payload, 'practiceId'))) return null;
  const iat = claimValue(payload, 'iat');
  const exp = claimValue(payload, 'exp');
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)
    || Number(iat) < 0 || Number(exp) <= Number(iat)
    || Number(exp) - Number(iat) > PRACTICE_SESSION_TTL_SECONDS
    || Number(iat) > now + MAX_CLOCK_SKEW_SECONDS
    || Number(exp) <= now) return null;
  const selected = validateReferences(claimValue(payload, 'selected'));
  if (!selected) return null;
  return {
    iss: PRACTICE_SESSION_ISSUER,
    aud: PRACTICE_SESSION_AUDIENCE,
    purpose: PRACTICE_SESSION_PURPOSE,
    version: PRACTICE_DELIVERY_VERSION,
    iat: Number(iat),
    exp: Number(exp),
    sessionId: claimValue(payload, 'sessionId') as string,
    practiceId: claimValue(payload, 'practiceId') as string,
    selected,
  };
};

export async function verifyPracticeSession(
  token: string,
  input: VerifyPracticeSessionOptions,
): Promise<PracticeSessionClaims | null> {
  const tokenBytes = typeof token === 'string' ? utf8ByteLength(token) : 0;
  if (typeof token !== 'string' || tokenBytes === 0 || tokenBytes > PRACTICE_MAX_SESSION_TOKEN_BYTES) return null;
  let secret: string;
  let now: number;
  try {
    secret = asSecret(input.jwtSecret);
    now = epochSeconds(input.now);
  } catch {
    return null;
  }
  try {
    const key = await practiceSigningKey(secret);
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: PRACTICE_SESSION_ISSUER,
      audience: PRACTICE_SESSION_AUDIENCE,
      currentDate: new Date(now * 1000),
    });
    return validateClaims(payload as Record<string, unknown>, now);
  } catch {
    // Do not log tokens, claims, answers, or secrets.  Callers receive one
    // stable invalid/expired outcome for all verification failures.
    return null;
  }
}

/**
 * Derive the deterministic context used by the answer-obscuring student DTO.
 * The session ID, source quiz and revision are all in the scope and in the
 * per-question key derivation, so a context from another session cannot decode
 * structured IDs from this session.
 */
export async function derivePracticeDtoContext(
  input: PracticeDtoContextInput,
): Promise<StudentQuizQuestionDtoContext> {
  const secret = asSecret(input.jwtSecret);
  const sessionId = normalizeId(input.sessionId, 'PRACTICE_SESSION_ID_INVALID');
  const quizId = normalizeId(input.quizId, 'PRACTICE_QUIZ_ID_INVALID');
  if (!isValidRevision(input.revision)) {
    throw new PracticeSessionError('PRACTICE_REVISION_INVALID', 'Practice question revision is invalid.');
  }
  const dtoContext = PRACTICE_DTO_KEY_CONTEXT;
  const sessionKey = await keyFromSecret(secret, dtoContext);
  const derivation = JSON.stringify([
    dtoContext,
    sessionId,
    quizId,
    input.revision,
  ]);
  const key = await hmac(sessionKey, derivation);
  return {
    quizId,
    revision: input.revision,
    scope: JSON.stringify(['practice-question-dto-v1', sessionId, quizId, input.revision]),
    key,
  };
}
