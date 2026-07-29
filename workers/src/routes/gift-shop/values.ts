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
    if (raw === 'PENDING' || raw === 'CREATED') return 'PENDING';
    if (raw === 'APPROVED' || raw === 'VOUCHER_ISSUED') return 'APPROVED';
    if (raw === 'DELIVERED') return 'DELIVERED';
    if (raw === 'CANCELLED' || raw === 'CANCELLED_REFUNDED') return 'CANCELLED';
    return null;
};

export const getIsoWeekKey = (date: Date): string => {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const gradeFromClassName = (value: unknown): number | null => {
    const match = String(value || '').trim().match(/[1-9]/);
    return match ? Number(match[0]) : null;
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
