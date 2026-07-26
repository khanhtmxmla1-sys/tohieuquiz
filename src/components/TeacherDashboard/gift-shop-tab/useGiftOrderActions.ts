import type { GiftOrderActor, GiftOrderQuery } from '../../../types/giftShop.types';

interface Options {
  actor: GiftOrderActor;
  query: GiftOrderQuery;
  deliverOrder: (orderId: string, actor: GiftOrderActor, queryAfter?: GiftOrderQuery) => Promise<boolean>;
  cancelOrder: (orderId: string, actor: GiftOrderActor, reason: string, queryAfter?: GiftOrderQuery) => Promise<boolean>;
}

export const useGiftOrderActions = ({ actor, query, deliverOrder, cancelOrder }: Options) => ({
  deliver: async (orderId: string) => {
    await deliverOrder(orderId, actor, query);
  },
  cancel: async (orderId: string, reason: string) => {
    await cancelOrder(orderId, actor, reason, query);
  },
});
