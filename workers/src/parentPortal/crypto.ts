import { hashPasswordPbkdf2, verifyPasswordPbkdf2 } from '../utils/password';

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const toHex = (bytes: Uint8Array): string => (
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
);

export function generateActivationToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashActivationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function generateAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, byte => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length]).join('');
}

export function validateParentPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function hashParentPin(pin: string): Promise<string> {
  if (!validateParentPin(pin)) throw new Error('PIN phụ huynh phải gồm đúng 6 chữ số.');
  return hashPasswordPbkdf2(pin);
}

export async function verifyParentPin(pin: string, encoded: string): Promise<boolean> {
  if (!validateParentPin(pin)) return false;
  return verifyPasswordPbkdf2(pin, encoded);
}
