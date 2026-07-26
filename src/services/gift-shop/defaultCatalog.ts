import type { GiftCatalogItem } from '../../types/giftShop.types';
import { nowIso } from './mockStateHelpers';

export const defaultCatalog = (): GiftCatalogItem[] => {
    const now = nowIso();
    return [
        {
            id: 'gift_snack_01',
            name: 'Sữa chua',
            category: 'SNACK',
            priceCoins: 120,
            imageUrl: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Cup%20with%20straw/3D/cup_with_straw_3d.png',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: 'gift_supply_01',
            name: 'Bút chì HB',
            category: 'SUPPLY',
            priceCoins: 180,
            imageUrl: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Pencil/3D/pencil_3d.png',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: 'gift_privilege_01',
            name: 'Đổi chỗ ngồi 1 buổi',
            category: 'PRIVILEGE',
            priceCoins: 400,
            imageUrl: 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Crown/3D/crown_3d.png',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
    ];
};
