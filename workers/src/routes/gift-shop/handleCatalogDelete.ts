import type { Env } from '../../types';
import { requireAdmin } from '../../middleware/jwtAuth';
import { extractIdFromPath } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import { getAuthenticatedUser } from './auth';
import { deactivateCatalogItem, getCatalogItemById } from './catalogRepository';
import { appendEvent } from './events';
import { mapCatalogItem } from './mappers';

export const handleCatalogDelete = async (request: Request, env: Env, path: string): Promise<Response> => {
    const itemId = extractIdFromPath(path, '/api/gift-shop/catalog');
    if (!itemId) return errorResponse('Missing catalog item ID');

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireAdmin(userOrResponse)) return errorResponse('Forbidden', 403);
    const actorUsername = userOrResponse.username || 'admin';

    const existingItem = await getCatalogItemById(env.DB, itemId);
    if (!existingItem) return errorResponse('Catalog item not found', 404);

    await deactivateCatalogItem(env.DB, itemId);
    await appendEvent(env.DB, {
        type: 'CATALOG_DELETED',
        actor: actorUsername,
        metadata: { itemId },
    });

    const item = await getCatalogItemById(env.DB, itemId);
    if (!item) return errorResponse('Catalog item not found', 404);
    return jsonResponse(mapCatalogItem(item));
};
