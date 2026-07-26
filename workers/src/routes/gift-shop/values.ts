import type { GiftOrderStatus } from './types';

export const nowIso = () => new Date().toISOString();

export const toBool = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
};

export const normalizeStatus = (value: unknown): GiftOrderStatus | 'ALL' | null => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;
    if (raw === 'ALL') return 'ALL';
    if (raw === 'CREATED') return 'CREATED';
    if (raw === 'VOUCHER_ISSUED') return 'VOUCHER_ISSUED';
    if (raw === 'DELIVERED') return 'DELIVERED';
    if (raw === 'CANCELLED_REFUNDED') return 'CANCELLED_REFUNDED';
    return null;
};

export const parseJson = <T>(raw: unknown, fallback: T): T => {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const generateVoucherCode = () => {
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const suffix = Date.now().toString().slice(-4);
    return `VCH-${randomPart}-${suffix}`;
};
