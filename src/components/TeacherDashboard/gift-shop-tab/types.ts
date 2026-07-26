import type { GiftCategory, GiftOrderActor, GiftOrderQuery, GiftOrderStatus } from '../../../types/giftShop.types';

export interface GiftCatalogFormState {
  name: string;
  category: GiftCategory;
  priceCoins: string;
  imageUrl: string;
}

export interface GiftShopFiltersState {
  statusFilter: GiftOrderStatus | 'ALL';
  setStatusFilter: (status: GiftOrderStatus | 'ALL') => void;
  classFilter: string;
  setClassFilter: (classId: string) => void;
  actor: GiftOrderActor;
  query: GiftOrderQuery;
}
