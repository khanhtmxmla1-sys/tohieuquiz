import type {
    GiftCatalogItem,
    GiftOrder,
    GiftOrderActor,
    GiftOrderQuery,
    GiftPurchasePayload,
    GiftPurchaseResponse,
    GiftShopEventLog,
} from '../../types/giftShop.types';
import {
    cancelOrderApi,
    deleteCatalogItemApi,
    deliverOrderApi,
    getCatalogApi,
    getEventLogsApi,
    getOrdersApi,
    purchaseApi,
    upsertCatalogItemApi,
} from './apiGiftShop';
import { getGiftShopMode } from './mode';
import { cancelOrderMock } from './mockCancellation';
import { deleteCatalogItemMock, getCatalogMock, upsertCatalogItemMock } from './mockCatalog';
import { deliverOrderMock } from './mockDelivery';
import { purchaseMock } from './mockPurchase';
import { getEventsMock, getOrdersMock } from './mockQueries';
import type {
    GiftCancelResult,
    GiftCatalogDeleteInput,
    GiftCatalogUpsertInput,
    GiftShopMode,
} from './types';

const usesApi = () => getGiftShopMode() === 'api';

export const giftShopService = {
    getMode: (): GiftShopMode => getGiftShopMode(),
    getCatalog: async (): Promise<GiftCatalogItem[]> =>
        usesApi() ? getCatalogApi() : getCatalogMock(),
    upsertCatalogItem: async (input: GiftCatalogUpsertInput): Promise<GiftCatalogItem> =>
        usesApi() ? upsertCatalogItemApi(input) : upsertCatalogItemMock(input),
    deleteCatalogItem: async (input: GiftCatalogDeleteInput): Promise<GiftCatalogItem> =>
        usesApi() ? deleteCatalogItemApi(input) : deleteCatalogItemMock(input),
    getOrders: async (query: GiftOrderQuery): Promise<GiftOrder[]> =>
        usesApi() ? getOrdersApi(query) : getOrdersMock(query),
    purchase: async (payload: GiftPurchasePayload): Promise<GiftPurchaseResponse> =>
        usesApi() ? purchaseApi(payload) : purchaseMock(payload),
    deliverOrder: async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> =>
        usesApi() ? deliverOrderApi(orderId, actor) : deliverOrderMock(orderId, actor),
    cancelOrder: async (
        orderId: string,
        actor: GiftOrderActor,
        reason: string
    ): Promise<GiftCancelResult> =>
        usesApi() ? cancelOrderApi(orderId, actor, reason) : cancelOrderMock(orderId, actor, reason),
    getEventLogs: async (): Promise<GiftShopEventLog[]> =>
        usesApi() ? getEventLogsApi() : getEventsMock(),
};
