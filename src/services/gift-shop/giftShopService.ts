import type {
    GiftCatalogItem, GiftOrder, GiftOrderActor, GiftOrderQuery, GiftPurchasePayload,
    GiftPurchaseResponse, GiftShopEventLog, GiftShopSettingsResponse, GiftShopSettingsUpdate,
} from '../../types/giftShop.types';
import {
    approveOrderApi, cancelOrderApi, deleteCatalogItemApi, deliverOrderApi, getCatalogApi,
    getEventLogsApi, getOrdersApi, getSettingsApi, purchaseApi, updateSettingsApi, upsertCatalogItemApi,
} from './apiGiftShop';
import { getGiftShopMode } from './mode';
import { approveOrderMock } from './mockApproval';
import { cancelOrderMock } from './mockCancellation';
import { deleteCatalogItemMock, getCatalogMock, upsertCatalogItemMock } from './mockCatalog';
import { deliverOrderMock } from './mockDelivery';
import { purchaseMock } from './mockPurchase';
import { getEventsMock, getOrdersMock } from './mockQueries';
import { getSettingsMock, updateSettingsMock } from './mockSettings';
import type { GiftCancelResult, GiftCatalogDeleteInput, GiftCatalogUpsertInput, GiftShopMode } from './types';

const usesApi = () => getGiftShopMode() === 'api';
export const giftShopService = {
    getMode: (): GiftShopMode => getGiftShopMode(),
    getCatalog: async (): Promise<GiftCatalogItem[]> => usesApi() ? getCatalogApi() : getCatalogMock(),
    upsertCatalogItem: async (input: GiftCatalogUpsertInput): Promise<GiftCatalogItem> => usesApi() ? upsertCatalogItemApi(input) : upsertCatalogItemMock(input),
    deleteCatalogItem: async (input: GiftCatalogDeleteInput): Promise<GiftCatalogItem> => usesApi() ? deleteCatalogItemApi(input) : deleteCatalogItemMock(input),
    getOrders: async (query: GiftOrderQuery): Promise<GiftOrder[]> => usesApi() ? getOrdersApi(query) : getOrdersMock(query),
    purchase: async (payload: GiftPurchasePayload): Promise<GiftPurchaseResponse> => usesApi() ? purchaseApi(payload) : purchaseMock(payload),
    approveOrder: async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> => usesApi() ? approveOrderApi(orderId, actor) : approveOrderMock(orderId, actor),
    deliverOrder: async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> => usesApi() ? deliverOrderApi(orderId, actor) : deliverOrderMock(orderId, actor),
    cancelOrder: async (orderId: string, actor: GiftOrderActor, reason: string): Promise<GiftCancelResult> => usesApi() ? cancelOrderApi(orderId, actor, reason) : cancelOrderMock(orderId, actor, reason),
    getSettings: async (): Promise<GiftShopSettingsResponse> => usesApi() ? getSettingsApi() : getSettingsMock(),
    updateSettings: async (input: GiftShopSettingsUpdate): Promise<GiftShopSettingsResponse> => usesApi() ? updateSettingsApi(input) : updateSettingsMock(input),
    getEventLogs: async (): Promise<GiftShopEventLog[]> => usesApi() ? getEventLogsApi() : getEventsMock(),
};
