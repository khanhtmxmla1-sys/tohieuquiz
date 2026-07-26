// Response helpers for Workers API

import { toArrayBuffer } from './bytes';

export function jsonResponse<T>(data: T, status = 200, cacheSeconds = 0): Response {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cacheSeconds > 0) headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
    return new Response(JSON.stringify(data), { status, headers });
}

export function successResponse<T>(data: T | null = null): Response {
    return jsonResponse({ status: 'success', data });
}

export function errorResponse(message: string, status = 400): Response {
    return jsonResponse({ status: 'error', message }, status);
}

export function generateId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().substring(0, 8)}`;
}

const PASSWORD_SCHEME = 'pbkdf2_sha256';
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;

const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex: string): Uint8Array | null => {
    if (!hex || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
    if (left.length !== right.length) return false;
    let mismatch = 0;
    for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
    return mismatch === 0;
};

const derivePbkdf2 = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
        key,
        PASSWORD_KEY_BYTES * 8,
    );
    return new Uint8Array(bits);
};

const legacySha256 = async (password: string): Promise<Uint8Array> =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)));

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
    const derived = await derivePbkdf2(password, salt, PASSWORD_ITERATIONS);
    return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(
    password: string,
    storedValue: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
    const stored = String(storedValue || '');
    if (stored.startsWith(`${PASSWORD_SCHEME}$`)) {
        const [scheme, rawIterations, rawSalt, rawHash] = stored.split('$');
        const iterations = Number(rawIterations);
        const salt = hexToBytes(rawSalt);
        const expected = hexToBytes(rawHash);
        if (scheme !== PASSWORD_SCHEME || !Number.isSafeInteger(iterations) || iterations < 100_000 || !salt || !expected) {
            return { valid: false, needsRehash: false };
        }
        const actual = await derivePbkdf2(password, salt, iterations);
        const valid = constantTimeEqual(actual, expected);
        return { valid, needsRehash: valid && iterations !== PASSWORD_ITERATIONS };
    }

    if (/^[0-9a-f]{64}$/i.test(stored)) {
        const actual = await legacySha256(password);
        return { valid: constantTimeEqual(actual, hexToBytes(stored)!), needsRehash: true };
    }

    return {
        valid: constantTimeEqual(new TextEncoder().encode(password), new TextEncoder().encode(stored)),
        needsRehash: true,
    };
}

export function generateRandomPassword(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const random = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(random, (byte) => chars[byte % chars.length]).join('');
}

export function sanitizeInput(str: unknown): string {
    if (typeof str !== 'string') return String(str ?? '');
    if (/^[=+\-@]/.test(str)) return `'${str}`;
    return str;
}

