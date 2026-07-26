import type { GiftOrder, GiftOrderQuery, GiftShopEventLog } from '../../types/giftShop.types';
import { applyOrderFilters } from './mockOrderAccess';
import { readMockState } from './mockState';

export const getOrdersMock = async (query: GiftOrderQuery): Promise<GiftOrder[]> => {
    const state = readMockState();
    return applyOrderFilters(state.orders, query).sort(
        (a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)
    );
};

export const getEventsMock = async (): Promise<GiftShopEventLog[]> =>
    readMockState().events;
