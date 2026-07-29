import type { Env } from '../../types';
import { requireAdmin } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { getRequestId } from '../../utils/logger';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
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
    const access = getActorAccessFromUser(userOrResponse);
    const payload = normalizeCatalogPayload(body, access.schoolId);
    if (!isValidCatalogPayload(payload)) return errorResponse('Invalid catalog payload');

    const id = String(body.id || generateId('gift')).trim();
    await insertCatalogItem(env.DB, id, payload, userOrResponse.username);
    await appendEvent(env.DB, {
        type: 'CATALOG_CREATED', actor: userOrResponse.username, requestId: getRequestId(request),
        metadata: { itemId: id, priceCoins: payload.priceCoins, scopeType: payload.scopeType },
    });
    const item = await getCatalogItemById(env.DB, id);
    return item ? jsonResponse(mapCatalogItem(item)) : errorResponse('Failed to create catalog item', 500);
};
