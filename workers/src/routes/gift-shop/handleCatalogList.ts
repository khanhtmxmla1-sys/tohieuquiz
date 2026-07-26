import type { Env } from '../../types';
import { jsonResponse } from '../../utils/response';
import { ensureCatalogSeed, listActiveCatalogItems } from './catalogRepository';
import { mapCatalogItem } from './mappers';

export const handleCatalogList = async (env: Env): Promise<Response> => {
    await ensureCatalogSeed(env.DB);
    const rows = await listActiveCatalogItems(env.DB);
    return jsonResponse((rows.results || []).map(mapCatalogItem));
};
