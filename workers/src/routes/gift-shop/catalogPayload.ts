import type { CatalogPayload } from './types';
import { toBool } from './values';

export const normalizeCatalogPayload = (body: Record<string, unknown>): CatalogPayload => ({
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim().toUpperCase(),
    imageUrl: String(body.imageUrl || '').trim(),
    priceCoins: Math.max(0, Math.floor(Number(body.priceCoins) || 0)),
    isActive: toBool(body.isActive ?? true) ? 1 : 0,
});

export const isValidCatalogPayload = (payload: CatalogPayload) => Boolean(
    payload.name && payload.category && payload.imageUrl && payload.priceCoins > 0,
);
