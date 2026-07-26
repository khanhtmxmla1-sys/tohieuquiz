import { useEffect } from 'react';
import type { GiftOrderQuery } from '../../../types/giftShop.types';

interface Options {
  isAdmin: boolean;
  query: GiftOrderQuery;
  loadCatalog: () => Promise<void>;
  loadManagedOrders: (query: GiftOrderQuery) => Promise<void>;
  loadEventLogs: () => Promise<void>;
}

export const useGiftShopRefresh = ({
  isAdmin,
  query,
  loadCatalog,
  loadManagedOrders,
  loadEventLogs,
}: Options) => {
  const refreshAll = async () => {
    await Promise.all([
      loadCatalog(),
      loadManagedOrders(query),
      isAdmin ? loadEventLogs() : Promise.resolve(),
    ]);
  };

  useEffect(() => {
    void refreshAll();
  }, [query.status, query.classId, isAdmin]);

  return refreshAll;
};
