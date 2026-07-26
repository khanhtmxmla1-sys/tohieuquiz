import { COLLECTIBLE_REWARDS } from './constants';
import type { CollectibleReward, RewardType } from './types';

export interface ChestReward {
    type: RewardType;
    payload: Record<string, unknown>;
}

export const chooseChestReward = (
    collection: CollectibleReward[],
    random: () => number = Math.random
): ChestReward => {
    const roll = random();
    if (roll < 0.55) {
        const owned = new Set(collection.map((item) => item.id));
        const collectible = COLLECTIBLE_REWARDS.find((item) => !owned.has(item.id));
        if (collectible) return { type: 'COLLECTIBLE', payload: collectible };
    }
    if (roll < 0.8) return {
        type: 'COINS', payload: { coins: 45, title: 'Túi xu nhỏ', icon: '🪙' },
    };
    if (roll < 0.92) return {
        type: 'HINT_TOKEN', payload: { amount: 1, title: 'Vé gợi ý', icon: '💡' },
    };
    return {
        type: 'STREAK_SHIELD',
        payload: { amount: 1, title: 'Khiên giữ chuỗi', icon: '🛡️' },
    };
};
