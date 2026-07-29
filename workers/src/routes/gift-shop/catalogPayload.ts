import type { GiftCatalogScope } from './types';
import type { CatalogPayload } from './types';
import { toBool } from './values';

const scopeType = (value: unknown): GiftCatalogScope => {
    const normalized = String(value || 'SCHOOL').trim().toUpperCase();
    return normalized === 'CLASS' || normalized === 'GRADE' ? normalized : 'SCHOOL';
};

const positiveInteger = (value: unknown, fallback: number): number => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const normalizeCatalogPayload = (body: Record<string, unknown>, defaultSchoolId = ''): CatalogPayload => ({
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim().toUpperCase(),
    imageUrl: String(body.imageUrl || '').trim(),
    priceCoins: Math.max(0, Math.floor(Number(body.priceCoins) || 0)),
    isActive: toBool(body.isActive ?? true) ? 1 : 0,
    stockTotal: positiveInteger(body.stockTotal, 100),
    lowStockThreshold: positiveInteger(body.lowStockThreshold, 5),
    weeklyLimitPerStudent: positiveInteger(body.weeklyLimitPerStudent, 1),
    scopeType: scopeType(body.scopeType),
    schoolId: String(body.schoolId ?? defaultSchoolId).trim(),
    classId: String(body.classId || '').trim() || null,
    gradeLevel: positiveInteger(body.gradeLevel, 0) || null,
});

export const isValidCatalogPayload = (payload: CatalogPayload) => Boolean(
    payload.name
    && payload.category
    && payload.imageUrl
    && payload.priceCoins > 0
    && payload.stockTotal >= 0
    && payload.lowStockThreshold >= 0
    && payload.weeklyLimitPerStudent >= 0
    && (payload.scopeType !== 'CLASS' || payload.classId)
    && (payload.scopeType !== 'GRADE' || payload.gradeLevel),
);
