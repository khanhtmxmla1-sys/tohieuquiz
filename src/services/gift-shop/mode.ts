import type { GiftShopMode } from './types';

const DEFAULT_MODE: GiftShopMode = 'api';

export const getGiftShopMode = (): GiftShopMode => {
    const mode = String(import.meta.env.VITE_GIFT_SHOP_MODE || DEFAULT_MODE).toLowerCase();
    return mode === 'api' ? 'api' : 'mock';
};
