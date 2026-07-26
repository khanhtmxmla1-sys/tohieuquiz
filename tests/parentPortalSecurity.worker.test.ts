// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  generateAccessCode,
  generateActivationToken,
  hashActivationToken,
  hashParentPin,
  validateParentPin,
  verifyParentPin,
} from '../workers/src/parentPortal/crypto';
import {
  clearParentCookie,
  createParentCookie,
  signParentSession,
  verifyParentSession,
  verifyParentSessionToken,
} from '../workers/src/parentPortal/session';
import { signJWT } from '../workers/src/utils/jwt';

const secret = 'test-secret-at-least-32-characters-long';

describe('parent portal cryptography', () => {
  it('generates opaque activation tokens and stable hashes', async () => {
    const token = generateActivationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashActivationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashActivationToken(token)).toBe(await hashActivationToken(token));
  });

  it('generates unambiguous ten-character access codes', () => {
    expect(generateAccessCode()).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });

  it('validates and verifies six-digit PINs', async () => {
    expect(validateParentPin('123456')).toBe(true);
    expect(validateParentPin('12345')).toBe(false);
    expect(validateParentPin('12345a')).toBe(false);

    const hash = await hashParentPin('123456');
    expect(hash).toMatch(/^pbkdf2_sha256\$100000\$/);
    await expect(verifyParentPin('123456', hash)).resolves.toBe(true);
    await expect(verifyParentPin('654321', hash)).resolves.toBe(false);
    await expect(hashParentPin('12345')).rejects.toThrow(/6 chữ số/i);
  });
});

describe('isolated parent sessions', () => {
  it('creates a host-only HttpOnly cookie and a matching clear cookie', () => {
    expect(createParentCookie('jwt')).toContain('parent_auth_token=jwt');
    expect(createParentCookie('jwt')).toContain('HttpOnly');
    expect(createParentCookie('jwt')).toContain('Secure');
    expect(createParentCookie('jwt')).toContain('SameSite=Lax');
    expect(createParentCookie('jwt')).toContain('Max-Age=2592000');
    expect(createParentCookie('jwt')).not.toContain('Domain=');
    expect(clearParentCookie()).toContain('parent_auth_token=');
    expect(clearParentCookie()).toContain('Max-Age=0');
  });

  it('accepts only the parent audience and purpose', async () => {
    const parentToken = await signParentSession({
      linkId: 'link-1',
      studentId: 'student-1',
      tokenVersion: 3,
      purpose: 'parent_session',
    }, secret);
    await expect(verifyParentSessionToken(parentToken, secret)).resolves.toMatchObject({
      linkId: 'link-1',
      studentId: 'student-1',
      tokenVersion: 3,
      purpose: 'parent_session',
    });

    const teacherToken = await signJWT({
      username: 'teacher-a',
      role: 'teacher',
      purpose: 'session',
    }, secret);
    await expect(verifyParentSessionToken(teacherToken, secret)).resolves.toBeNull();
  });

  it('reloads the link and rejects revoked or stale sessions', async () => {
    const token = await signParentSession({
      linkId: 'link-1',
      studentId: 'student-1',
      tokenVersion: 3,
      purpose: 'parent_session',
    }, secret);
    const request = new Request('https://phuhuynh.thtohieu.com/api/parent/session', {
      headers: { Cookie: `parent_auth_token=${token}` },
    });

    const activeRepository = {
      findById: async () => ({
        id: 'link-1', studentId: 'student-1', accessCode: 'ABCDEFG234',
        pinHash: 'hash', status: 'ACTIVE' as const, tokenVersion: 3,
        createdBy: 'teacher-a', createdAt: '2026-07-22T00:00:00.000Z',
        activatedAt: '2026-07-22T00:00:00.000Z', revokedAt: null, lastAccessedAt: null,
      }),
    };
    await expect(verifyParentSession(request, secret, activeRepository)).resolves.toMatchObject({
      linkId: 'link-1', studentId: 'student-1', tokenVersion: 3,
    });

    await expect(verifyParentSession(request, secret, {
      findById: async () => ({ ...(await activeRepository.findById()), status: 'REVOKED' as const }),
    })).resolves.toBeNull();
    await expect(verifyParentSession(request, secret, {
      findById: async () => ({ ...(await activeRepository.findById()), tokenVersion: 4 }),
    })).resolves.toBeNull();
  });
});
