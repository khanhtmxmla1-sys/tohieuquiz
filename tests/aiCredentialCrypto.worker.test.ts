// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  decryptCredential,
  encryptCredential,
} from '../workers/src/services/aiCredentials/crypto';

const key = Buffer.alloc(32, 7).toString('base64');
const otherKey = Buffer.alloc(32, 9).toString('base64');
const keyring = JSON.stringify({ activeKeyId: 'k1', keys: { k1: key, k2: otherKey } });

describe('teacher AI credential crypto', () => {
  it('round-trips a credential without storing plaintext and uses a fresh 96-bit IV', async () => {
    const plaintext = 'credential-canary-value-1234567890';
    const first = await encryptCredential(keyring, 'teacher-a', 'gemini', plaintext);
    const second = await encryptCredential(keyring, 'teacher-a', 'gemini', plaintext);

    expect(first).toMatchObject({ formatVersion: 1, keyId: 'k1' });
    expect(Buffer.from(first.iv, 'base64')).toHaveLength(12);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(JSON.stringify(first)).not.toContain(plaintext);
    await expect(decryptCredential(keyring, 'teacher-a', 'gemini', first)).resolves.toBe(plaintext);
  });

  it('binds ciphertext to owner and provider through AAD', async () => {
    const cipher = await encryptCredential(keyring, 'teacher-a', 'gemini', 'secret-value-123456');

    await expect(decryptCredential(keyring, 'teacher-b', 'gemini', cipher)).rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(decryptCredential(keyring, 'teacher-a', 'deepseek', cipher)).rejects.toThrow('AI_VAULT_UNAVAILABLE');
  });

  it('rejects tampering, unknown key ids and malformed keyrings', async () => {
    const cipher = await encryptCredential(keyring, 'teacher-a', 'deepseek', 'secret-value-123456');
    const bytes = Buffer.from(cipher.ciphertext, 'base64');
    bytes[0] ^= 0xff;

    await expect(decryptCredential(keyring, 'teacher-a', 'deepseek', {
      ...cipher,
      ciphertext: bytes.toString('base64'),
    })).rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(decryptCredential(keyring, 'teacher-a', 'deepseek', {
      ...cipher,
      keyId: 'missing',
    })).rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(encryptCredential('', 'teacher-a', 'gemini', 'secret-value-123456'))
      .rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(encryptCredential(
      JSON.stringify({ activeKeyId: 'bad', keys: { bad: Buffer.alloc(31).toString('base64') } }),
      'teacher-a',
      'gemini',
      'secret-value-123456',
    )).rejects.toThrow('AI_VAULT_UNAVAILABLE');
    await expect(encryptCredential(
      JSON.stringify({ activeKeyId: 'key id with spaces', keys: { 'key id with spaces': key } }),
      'teacher-a',
      'gemini',
      'secret-value-123456',
    )).rejects.toThrow('AI_VAULT_UNAVAILABLE');
  });
});
