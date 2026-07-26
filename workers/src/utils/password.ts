const PBKDF2_PREFIX = '$pbkdf2-sha256$';
const WORKERS_PBKDF2_PREFIX = 'pbkdf2_sha256$';
// 100k is the highest iteration count already proven stable in this Workers runtime.
// Keeping the production encoding also preserves rollback compatibility.
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

import { toArrayBuffer } from './bytes';

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array | null {
    if (!value || value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) return null;
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}

function constantTimeEqual(actual: Uint8Array, expected: Uint8Array): boolean {
    if (actual.byteLength !== expected.byteLength) return false;
    const subtle = crypto.subtle as SubtleCrypto & {
        timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
    };
    if (subtle.timingSafeEqual) return subtle.timingSafeEqual(actual, expected);
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
        material,
        HASH_BYTES * 8,
    );
    return new Uint8Array(bits);
}

export function isPbkdf2Password(value: string): boolean {
    return value.startsWith(PBKDF2_PREFIX) || value.startsWith(WORKERS_PBKDF2_PREFIX);
}

export async function hashPasswordPbkdf2(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hash = await derivePassword(password, salt, PBKDF2_ITERATIONS);
    return `${WORKERS_PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyPasswordPbkdf2(password: string, encoded: string): Promise<boolean> {
    try {
        const parts = encoded.split('$');
        let iterations: number;
        let salt: Uint8Array | null;
        let expected: Uint8Array | null;

        if (encoded.startsWith(PBKDF2_PREFIX)) {
            if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') return false;
            iterations = Number(parts[2]);
            salt = base64UrlToBytes(parts[3]);
            expected = base64UrlToBytes(parts[4]);
        } else if (encoded.startsWith(WORKERS_PBKDF2_PREFIX)) {
            if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
            iterations = Number(parts[1]);
            salt = hexToBytes(parts[2]);
            expected = hexToBytes(parts[3]);
        } else {
            return false;
        }

        if (!Number.isSafeInteger(iterations) || iterations < 100_000 || !salt || !expected) return false;
        const actual = await derivePassword(password, salt, iterations);
        return constantTimeEqual(actual, expected);
    } catch {
        return false;
    }
}

export function validateNewPassword(password: unknown): string | null {
    if (typeof password !== 'string') return 'Mật khẩu mới không hợp lệ.';
    if (password.length < 10) return 'Mật khẩu phải có ít nhất 10 ký tự.';
    if (password.length > 128) return 'Mật khẩu không được vượt quá 128 ký tự.';
    return null;
}

export function generateTemporaryPassword(length = 20): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
