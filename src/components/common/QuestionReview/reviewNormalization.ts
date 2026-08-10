export const normalizeBooleanValue = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
};

const isSelectedIndexFlag = (value: unknown): boolean => {
    if (value === true || value === 1) return true;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
};

export const normalizeIndexList = (value: unknown, maxLength: number): number[] => {
    const raw = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? Object.entries(value as Record<string, unknown>)
                .filter(([, selected]) => isSelectedIndexFlag(selected))
                .map(([index]) => index)
            : [];

    return Array.from(new Set(
        raw
            .map((item) => Number(item))
            .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength)
    ));
};
