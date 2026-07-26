import type { Env } from '../../types';
import { requireAdmin } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import { getAuthenticatedUser } from './auth';
import { getCatalogItemById, updateCatalogItem } from './catalogRepository';
import { isValidCatalogPayload, normalizeCatalogPayload } from './catalogPayload';
import { appendEvent } from './events';
import { mapCatalogItem } from './mappers';

export const handleCatalogUpdate = async (request: Request, env: Env, path: string): Promise<Response> => {
    const itemId = extractIdFromPath(path, '/api/gift-shop/catalog');
    if (!itemId) return errorResponse('Missing catalog item ID');

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireAdmin(userOrResponse)) return errorResponse('Forbidden', 403);

    const payload = normalizeCatalogPayload(body);
    if (!isValidCatalogPayload(payload)) return errorResponse('Invalid catalog payload');

    const existingItem = await getCatalogItemById(env.DB, itemId);
    if (!existingItem) return errorResponse('Catalog item not found', 404);

    await updateCatalogItem(env.DB, itemId, payload);
    await appendEvent(env.DB, {
        type: 'CATALOG_UPDATED',
        metadata: { itemId, priceCoins: payload.priceCoins },
    });

    const item = await getCatalogItemById(env.DB, itemId);
    if (!item) return errorResponse('Catalog item not found', 404);
    return jsonResponse(mapCatalogItem(item));
};
