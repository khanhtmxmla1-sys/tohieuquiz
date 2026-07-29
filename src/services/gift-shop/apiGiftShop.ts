import { callApi } from '../apiAdapter';
import type {
    GiftCatalogItem,
    GiftOrder,
    GiftOrderActor,
    GiftOrderQuery,
    GiftPurchasePayload,
    GiftPurchaseResponse,
    GiftShopEventLog,
    GiftShopSettingsResponse,
    GiftShopSettingsUpdate,
} from '../../types/giftShop.types';
import { toApiCatalogPayload } from './catalogPayload';
import type { GiftCancelResult, GiftCatalogDeleteInput, GiftCatalogUpsertInput } from './types';

export const getCatalogApi = async (): Promise<GiftCatalogItem[]> => {
    const data = await callApi<GiftCatalogItem[]>('get_gift_shop_catalog');
    return Array.isArray(data) ? data : [];
};
export const upsertCatalogItemApi = async (input: GiftCatalogUpsertInput): Promise<GiftCatalogItem> =>
    await callApi<GiftCatalogItem>(input.id ? 'update_gift_shop_catalog_item' : 'create_gift_shop_catalog_item', toApiCatalogPayload(input));
export const deleteCatalogItemApi = async (input: GiftCatalogDeleteInput): Promise<GiftCatalogItem> =>
    await callApi<GiftCatalogItem>('delete_gift_shop_catalog_item', { id: input.id, actorIsAdmin: Boolean(input.actorIsAdmin), actorUsername: input.actorUsername || '' });
export const getOrdersApi = async (query: GiftOrderQuery): Promise<GiftOrder[]> => {
    const orders: GiftOrder[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
        const response = await callApi<{
            data?: GiftOrder[];
            meta?: { nextCursor?: string | null; hasMore?: boolean };
        }>('get_gift_shop_orders', { ...query, cursor, limit: 100 });
        orders.push(...(Array.isArray(response.data) ? response.data : []));
        cursor = response.meta?.nextCursor || undefined;
        if (!cursor || response.meta?.hasMore === false) break;
    }
    return orders;
};
export const purchaseApi = async (payload: GiftPurchasePayload): Promise<GiftPurchaseResponse> =>
    await callApi<GiftPurchaseResponse>('purchase_gift_shop_item', payload);
export const approveOrderApi = async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> =>
    await callApi<GiftOrder>('approve_gift_shop_order', { orderId, ...actor });
export const deliverOrderApi = async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> =>
    await callApi<GiftOrder>('deliver_gift_shop_order', { orderId, ...actor });
export const cancelOrderApi = async (orderId: string, actor: GiftOrderActor, reason: string): Promise<GiftCancelResult> =>
    await callApi<GiftCancelResult>('cancel_gift_shop_order', { orderId, reason, ...actor });
export const getSettingsApi = async (): Promise<GiftShopSettingsResponse> =>
    await callApi<GiftShopSettingsResponse>('get_gift_shop_settings');
export const updateSettingsApi = async (input: GiftShopSettingsUpdate): Promise<GiftShopSettingsResponse> =>
    await callApi<GiftShopSettingsResponse>('update_gift_shop_settings', input);
export const getEventLogsApi = async (): Promise<GiftShopEventLog[]> =>
    await callApi<GiftShopEventLog[]>('get_gift_shop_event_logs');
