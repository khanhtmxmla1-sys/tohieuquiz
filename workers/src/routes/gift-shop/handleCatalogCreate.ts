import type { Env } from '../../types';
import { requireAdmin } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';
import { getAuthenticatedUser } from './auth';
import { getCatalogItemById, insertCatalogItem } from './catalogRepository';
import { isValidCatalogPayload, normalizeCatalogPayload } from './catalogPayload';
import { appendEvent } from './events';
import { mapCatalogItem } from './mappers';

export const handleCatalogCreate = async (request: Request, env: Env): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireAdmin(userOrResponse)) return errorResponse('Forbidden', 403);

    const payload = normalizeCatalogPayload(body);
    if (!isValidCatalogPayload(payload)) return errorResponse('Invalid catalog payload');

    const id = String(body.id || generateId('gift')).trim();
    await insertCatalogItem(env.DB, id, payload);
    await appendEvent(env.DB, {
        type: 'CATALOG_CREATED',
        metadata: { itemId: id, priceCoins: payload.priceCoins },
    });

    const item = await getCatalogItemById(env.DB, id);
    if (!item) return errorResponse('Failed to create catalog item', 500);
    return jsonResponse(mapCatalogItem(item));
};
