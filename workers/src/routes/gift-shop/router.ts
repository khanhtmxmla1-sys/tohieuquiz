import type { Env } from '../../types';
import { errorResponse } from '../../utils/response';
import { handleCancellation } from './handleCancellation';
import { handleCatalogCreate } from './handleCatalogCreate';
import { handleCatalogDelete } from './handleCatalogDelete';
import { handleCatalogList } from './handleCatalogList';
import { handleCatalogUpdate } from './handleCatalogUpdate';
import { handleDelivery } from './handleDelivery';
import { handleEvents } from './handleEvents';
import { handleOrderList } from './handleOrderList';
import { handlePurchase } from './handlePurchase';

export async function handleGiftShopRoutes(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response> {
    if (path === '/api/gift-shop/catalog' && method === 'GET') return handleCatalogList(env);
    if (path === '/api/gift-shop/catalog' && method === 'POST') return handleCatalogCreate(request, env);
    if (path.startsWith('/api/gift-shop/catalog/') && method === 'PUT') {
        return handleCatalogUpdate(request, env, path);
    }
    if (path.startsWith('/api/gift-shop/catalog/') && method === 'DELETE') {
        return handleCatalogDelete(request, env, path);
    }
    if (path === '/api/gift-shop/orders' && method === 'GET') return handleOrderList(request, env);
    if (path === '/api/gift-shop/purchase' && method === 'POST') return handlePurchase(request, env);
    if (path.match(/^\/api\/gift-shop\/orders\/[^/]+\/deliver$/) && method === 'PATCH') {
        return handleDelivery(request, env, path);
    }
    if (path.match(/^\/api\/gift-shop\/orders\/[^/]+\/cancel$/) && method === 'PATCH') {
        return handleCancellation(request, env, path);
    }
    if (path === '/api/gift-shop/events' && method === 'GET') return handleEvents(request, env);
    return errorResponse('Not found: ' + path, 404);
}
