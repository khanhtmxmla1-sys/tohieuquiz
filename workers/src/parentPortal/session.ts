import { SignJWT, jwtVerify } from 'jose';
import type {
  ParentSessionLinkLoader,
  ParentSessionPayload,
} from './types';

const PARENT_COOKIE = 'parent_auth_token';
const PARENT_ISSUER = 'tohieuquiz-api';
const PARENT_AUDIENCE = 'tohieuquiz-parent-portal';
const PARENT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const keyFromSecret = (secret: string) => new TextEncoder().encode(secret);

const extractParentToken = (request: Request): string | null => {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const [name, ...valueParts] = item.trim().split('=');
    if (name === PARENT_COOKIE) return valueParts.join('=') || null;
  }
  return null;
};

const isParentPayload = (value: Record<string, unknown>): value is ParentSessionPayload & Record<string, unknown> => (
  typeof value.linkId === 'string'
  && value.linkId.length > 0
  && value.linkId.length <= 128
  && typeof value.studentId === 'string'
  && value.studentId.length > 0
  && value.studentId.length <= 128
  && Number.isInteger(value.tokenVersion)
  && Number(value.tokenVersion) >= 0
  && value.purpose === 'parent_session'
);

export async function signParentSession(payload: ParentSessionPayload, secret: string): Promise<string> {
  if (!isParentPayload(payload as unknown as Record<string, unknown>)) {
    throw new Error('Invalid parent session payload');
  }
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(PARENT_ISSUER)
    .setAudience(PARENT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(keyFromSecret(secret));
}

export async function verifyParentSessionToken(
  token: string,
  secret: string,
): Promise<ParentSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, keyFromSecret(secret), {
      algorithms: ['HS256'],
      issuer: PARENT_ISSUER,
      audience: PARENT_AUDIENCE,
    });
    const candidate = payload as Record<string, unknown>;
    if (!isParentPayload(candidate)) return null;
    return {
      linkId: candidate.linkId,
      studentId: candidate.studentId,
      tokenVersion: Number(candidate.tokenVersion),
      purpose: 'parent_session',
    };
  } catch {
    return null;
  }
}

export async function verifyParentSession(
  request: Request,
  secret: string,
  repository: ParentSessionLinkLoader,
): Promise<ParentSessionPayload | null> {
  const token = extractParentToken(request);
  if (!token) return null;
  const payload = await verifyParentSessionToken(token, secret);
  if (!payload) return null;

  const link = await repository.findById(payload.linkId);
  if (!link || link.status !== 'ACTIVE') return null;
  if (link.studentId !== payload.studentId) return null;
  if (link.tokenVersion !== payload.tokenVersion) return null;
  return payload;
}

export function createParentCookie(token: string): string {
  return [
    `${PARENT_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${PARENT_MAX_AGE_SECONDS}`,
    'Path=/',
  ].join('; ');
}

export function clearParentCookie(): string {
  return [
    `${PARENT_COOKIE}=`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
    'Path=/',
  ].join('; ');
}
