export const safeJsonParse = <T>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const normalizeGameLoopCategory = (value: string): string => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'toan' || normalized.includes('toán')) return 'toan';
    if (normalized === 'tieng-viet' || normalized.includes('việt')) return 'tieng-viet';
    return normalized;
};
