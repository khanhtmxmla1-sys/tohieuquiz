import { callApi } from '../apiAdapter';
import type {
    GiftCatalogItem,
    GiftOrder,
    GiftOrderActor,
    GiftOrderQuery,
    GiftPurchasePayload,
    GiftPurchaseResponse,
    GiftShopEventLog,
} from '../../types/giftShop.types';
import { toApiCatalogPayload } from './catalogPayload';
import type { GiftCancelResult, GiftCatalogDeleteInput, GiftCatalogUpsertInput } from './types';

export const getCatalogApi = async (): Promise<GiftCatalogItem[]> => {
    const data = await callApi<GiftCatalogItem[]>('get_gift_shop_catalog');
    return Array.isArray(data) ? data : [];
};

export const upsertCatalogItemApi = async (
    input: GiftCatalogUpsertInput
): Promise<GiftCatalogItem> => {
    const action = input.id
        ? 'update_gift_shop_catalog_item'
        : 'create_gift_shop_catalog_item';
    return await callApi<GiftCatalogItem>(action, toApiCatalogPayload(input));
};

export const deleteCatalogItemApi = async (
    input: GiftCatalogDeleteInput
): Promise<GiftCatalogItem> =>
    await callApi<GiftCatalogItem>('delete_gift_shop_catalog_item', {
        id: input.id,
        actorIsAdmin: Boolean(input.actorIsAdmin),
        actorUsername: input.actorUsername || '',
    });

export const getOrdersApi = async (query: GiftOrderQuery): Promise<GiftOrder[]> =>
    await callApi<GiftOrder[]>('get_gift_shop_orders', query);

export const purchaseApi = async (
    payload: GiftPurchasePayload
): Promise<GiftPurchaseResponse> =>
    await callApi<GiftPurchaseResponse>('purchase_gift_shop_item', payload);

export const deliverOrderApi = async (
    orderId: string,
    actor: GiftOrderActor
): Promise<GiftOrder> =>
    await callApi<GiftOrder>('deliver_gift_shop_order', { orderId, ...actor });

export const cancelOrderApi = async (
    orderId: string,
    actor: GiftOrderActor,
    reason: string
): Promise<GiftCancelResult> =>
    await callApi<GiftCancelResult>('cancel_gift_shop_order', { orderId, reason, ...actor });

export const getEventLogsApi = async (): Promise<GiftShopEventLog[]> =>
    await callApi<GiftShopEventLog[]>('get_gift_shop_event_logs');
