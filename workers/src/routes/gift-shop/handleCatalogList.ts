import type { Env } from '../../types';
import { jsonResponse } from '../../utils/response';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { ensureCatalogSeed, listCatalogItems } from './catalogRepository';
import { mapCatalogItem } from './mappers';

export const handleCatalogList = async (request: Request, env: Env): Promise<Response> => {
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    await ensureCatalogSeed(env.DB);
    const access = getActorAccessFromUser(userOrResponse);
    const rows = await listCatalogItems(env.DB, {
        role: userOrResponse.role,
        studentId: userOrResponse.id,
        username: userOrResponse.username,
        classScope: access.teacherClass,
    });
    return jsonResponse((rows.results || []).map(mapCatalogItem));
};
