import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../workers/src/utils/response';

async function legacySha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

describe('versioned password hashing', () => {
  it('creates salted PBKDF2 hashes instead of deterministic SHA-256', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(second).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(first).not.toBe(second);
  });

  it('verifies current hashes without requiring migration', async () => {
    const stored = await hashPassword('secret-value');
    await expect(verifyPassword('secret-value', stored)).resolves.toEqual({ valid: true, needsRehash: false });
    await expect(verifyPassword('wrong', stored)).resolves.toEqual({ valid: false, needsRehash: false });
  });

  it('accepts a legacy SHA-256 hash once and marks it for rehash', async () => {
    const stored = await legacySha256('legacy-password');
    await expect(verifyPassword('legacy-password', stored)).resolves.toEqual({ valid: true, needsRehash: true });
  });

  it('accepts a legacy plaintext value once and marks it for rehash', async () => {
    await expect(verifyPassword('plain1', 'plain1')).resolves.toEqual({ valid: true, needsRehash: true });
    await expect(verifyPassword('wrong', 'plain1')).resolves.toEqual({ valid: false, needsRehash: true });
  });
});
