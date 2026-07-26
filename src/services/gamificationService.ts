/**
 * Gamification Service
 *
 * API calls to the Cloudflare Worker for Pet System, Shop, and Rewards.
 */

import {
    PetData as UserPet,
    ShopItem,
    PurchaseResult as BuyItemResponse,
    LeaderboardEntry,
    GameStateResult,
    ResultRewardClaimResult,
    TopGoldStudent,
} from '../types/gamification.types';
import { callApi } from './apiAdapter';

// Response type returned by the Worker API
interface GamificationApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
}

/**
 * Helper to call the canonical Worker API
 */
const callWorkerApi = async <T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<GamificationApiResponse<T>> => {
    try {
        const data = await callApi<GamificationApiResponse<T>>(action, payload);
        return { status: 'success', data: data.data ?? (data as any) };
    } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error(`[GamificationService] API Error [${action}]:`, error);
        return { status: 'error', message: normalizedError.message || 'Unknown API error' };
    }
};

// ==========================================
// PET DATA
// ==========================================

/**
 * Get pet data, coins, and shop items for a student.
 * If no pet exists, server auto-creates a default one.
 */
export const getPetData = async (
    username: string,
    petId?: string,
    petName?: string
): Promise<{ pet: UserPet; coins: number; shopItems: ShopItem[] } | null> => {
    const res = await callWorkerApi<{ pet: UserPet; coins: number; shopItems: ShopItem[] }>(
        'get_pet_data',
        { username, petId, petName }
    );
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    return null;
};

// ==========================================
// GAME STATE
// ==========================================

/**
 * Update game state after completing a quiz.
 * Adds EXP and coins, checks for level up.
 */
export const updateGameState = async (
    username: string,
    addExp: number,
    addCoins: number
): Promise<GameStateResult | null> => {
    const res = await callWorkerApi<GameStateResult>('update_game_state', {
        username,
        addExp,
        addCoins,
    });
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    return null;
};

export const claimResultReward = async (
    username: string,
    resultId: string,
): Promise<ResultRewardClaimResult | null> => {
    const res = await callWorkerApi<ResultRewardClaimResult>('claim_result_reward', {
        username,
        resultId,
    });
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    return null;
};

// ==========================================
// SHOP
// ==========================================

/**
 * Buy a shop item for the pet.
 * Deducts coins and adds item to pet inventory.
 */
export const buyShopItem = async (
    username: string,
    itemId: string
): Promise<BuyItemResponse | null> => {
    const res = await callWorkerApi<BuyItemResponse>('buy_shop_item', {
        username,
        itemId,
    });
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    // Throw with server message for better UX
    throw new Error(res.message || 'Không thể mua đồ.');
};


export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    const res = await callWorkerApi<LeaderboardEntry[]>('get_leaderboard');
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    return [];
};

export const getTopGoldLeaderboard = async (): Promise<TopGoldStudent[]> => {
    try {
        const res = await callWorkerApi<TopGoldStudent[]>('get_top_gold_leaderboard');
        if (res.status === 'success' && Array.isArray(res.data)) {
            return res.data;
        }
    } catch (e) {
        console.error('[GamificationService] fetch top gold failed:', e);
    }
    return [];
};


