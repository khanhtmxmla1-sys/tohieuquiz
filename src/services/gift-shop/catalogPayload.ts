import type { GiftCatalogUpsertInput } from './types';

export const toApiCatalogPayload = (input: GiftCatalogUpsertInput) => ({
    id: input.id,
    name: input.name.trim(),
    category: input.category,
    priceCoins: Math.max(0, Math.floor(Number(input.priceCoins) || 0)),
    imageUrl: input.imageUrl.trim(),
    isActive: input.isActive ?? true,
    actorIsAdmin: Boolean(input.actorIsAdmin),
});
