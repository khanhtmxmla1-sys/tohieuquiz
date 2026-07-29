import type { GiftCatalogUpsertInput } from './types';

export const toApiCatalogPayload = (input: GiftCatalogUpsertInput) => ({
    id: input.id,
    name: input.name.trim(),
    category: input.category,
    priceCoins: Math.max(0, Math.floor(Number(input.priceCoins) || 0)),
    imageUrl: input.imageUrl.trim(),
    isActive: input.isActive ?? true,
    stockTotal: Math.max(0, Math.floor(Number(input.stockTotal) || 0)),
    lowStockThreshold: Math.max(0, Math.floor(Number(input.lowStockThreshold) || 0)),
    weeklyLimitPerStudent: Math.max(0, Math.floor(Number(input.weeklyLimitPerStudent) || 0)),
    scopeType: input.scopeType,
    schoolId: String(input.schoolId || '').trim(),
    classId: String(input.classId || '').trim() || undefined,
    gradeLevel: input.gradeLevel ? Math.floor(Number(input.gradeLevel)) : undefined,
    actorIsAdmin: Boolean(input.actorIsAdmin),
});
