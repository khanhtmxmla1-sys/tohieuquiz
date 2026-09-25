import type { AiCredentialCipher, PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';

const VAULT_ERROR = 'AI_VAULT_UNAVAILABLE';
const encoder = new TextEncoder();

type KeyringPayload = {
  activeKeyId: string;
  keys: Record<string, string>;
};

const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const vaultError = (): Error => new Error(VAULT_ERROR);

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw vaultError();
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (bytesToBase64(bytes) !== value) throw vaultError();
    return bytes;
  } catch {
    throw vaultError();
  }
};

const parseKeyring = (raw: string): KeyringPayload => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw vaultError();
    const record = parsed as Record<string, unknown>;
    if (typeof record.activeKeyId !== 'string' || !KEY_ID_PATTERN.test(record.activeKeyId)) {
      throw vaultError();
    }
    if (!record.keys || typeof record.keys !== 'object' || Array.isArray(record.keys)) throw vaultError();

    const keys: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const [keyId, encoded] of Object.entries(record.keys as Record<string, unknown>)) {
      if (!KEY_ID_PATTERN.test(keyId) || typeof encoded !== 'string') throw vaultError();
      const bytes = base64ToBytes(encoded);
      if (bytes.byteLength !== 32) throw vaultError();
      keys[keyId] = encoded;
    }
    if (!keys[record.activeKeyId]) throw vaultError();
    return { activeKeyId: record.activeKeyId, keys };
  } catch {
    throw vaultError();
  }
};

const importAesKey = async (encodedKey: string): Promise<CryptoKey> => {
  const bytes = base64ToBytes(encodedKey);
  if (bytes.byteLength !== 32) throw vaultError();
  try {
    return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } catch {
    throw vaultError();
  }
};

const aadFor = (owner: string, provider: PersonalAiProvider): Uint8Array => (
  encoder.encode(JSON.stringify(['teacher-ai-key', 1, owner, provider]))
);

export async function encryptCredential(
  keyringRaw: string,
  owner: string,
  provider: PersonalAiProvider,
  plaintext: string,
): Promise<AiCredentialCipher> {
  try {
    const keyring = parseKeyring(keyringRaw);
    const key = await importAesKey(keyring.keys[keyring.activeKeyId]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadFor(owner, provider),
        tagLength: 128,
      },
      key,
      encoder.encode(plaintext),
    );
    return {
      formatVersion: 1,
      keyId: keyring.activeKeyId,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  } catch {
    throw vaultError();
  }
}

export async function decryptCredential(
  keyringRaw: string,
  owner: string,
  provider: PersonalAiProvider,
  cipher: AiCredentialCipher,
): Promise<string> {
  try {
    if (cipher.formatVersion !== 1 || !cipher.keyId) throw vaultError();
    const keyring = parseKeyring(keyringRaw);
    const encodedKey = keyring.keys[cipher.keyId];
    if (!encodedKey) throw vaultError();

    const iv = base64ToBytes(cipher.iv);
    const ciphertext = base64ToBytes(cipher.ciphertext);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 16) throw vaultError();

    const key = await importAesKey(encodedKey);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadFor(owner, provider),
        tagLength: 128,
      },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw vaultError();
  }
}
