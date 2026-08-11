/**
 * Gamification Store
 *
 * Zustand store for Pet System state management:
 * Pet data, coins, shop items, leaderboard.
 *
 * Works alongside useClassroomStore (which handles auth).
 * Data is loaded after student login and kept in memory. The server is authoritative.
 */

import { create } from 'zustand';
import {
    PetData,
    ShopItem,
    LeaderboardEntry,
    PetMood,
    TopGoldStudent,
    ResultRewardClaimResult,
} from '../types/gamification.types';
import * as gamificationService from '../services/gamificationService';

// --- Store Interface ---

interface GamificationStore {
    // State
    pet: PetData | null;
    coins: number;
    shopItems: ShopItem[];
    leaderboard: LeaderboardEntry[];
    topGoldLeaderboard: TopGoldStudent[];
    isLoading: boolean;
    error: string | null;

    // Reward animation state
    lastReward: {
        exp: number;
        coins: number;
        leveledUp: boolean;
        newLevel: number;
    } | null;

    // Actions
    loadPetData: (username: string) => Promise<void>;
    initFromLoginData: (pet: PetData | null, coins: number, shopItems: ShopItem[]) => void;
    claimResultReward: (username: string, resultId: string) => Promise<ResultRewardClaimResult | null>;
    fetchPetData: (username: string) => Promise<void>;
    buyItem: (username: string, itemId: string) => Promise<boolean>;
    fetchLeaderboard: () => Promise<void>;
    fetchTopGoldLeaderboard: () => Promise<void>;
    clearReward: () => void;
    clearGamification: () => void;
    clearError: () => void;
}

// --- Store ---

export const useGamificationStore = create<GamificationStore>((set, get) => ({
    pet: null,
    coins: 0,
    shopItems: [],
    leaderboard: [],
    topGoldLeaderboard: [],
    isLoading: false,
    error: null,
    lastReward: null,

    /**
     * Load pet data from server (also creates default pet if none exists)
     */
    loadPetData: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
            const result = await gamificationService.getPetData(username);
            if (result) {
                set({
                    pet: result.pet,
                    coins: result.coins,
                    shopItems: result.shopItems,
                    isLoading: false,
                });
            } else {
                set({ error: 'Không thể tải dữ liệu Pet.', isLoading: false });
            }
        } catch {
            set({ error: 'Lỗi khi tải dữ liệu Pet.', isLoading: false });
        }
    },

    /**
     * Alias for loadPetData to match interface
     */
    fetchPetData: async (username: string) => {
        await get().loadPetData(username);
    },

    /**
     * Initialize from login response (no extra API call needed)
     */
    initFromLoginData: (pet: PetData | null, coins: number, shopItems: ShopItem[]) => {
        set({ pet, coins, shopItems });
    },

    claimResultReward: async (username: string, resultId: string) => {
        set({ isLoading: true, error: null });
        try {
            const result = await gamificationService.claimResultReward(username, resultId);
            if (!result) {
                set({ error: 'Không thể đồng bộ phần thưởng.', isLoading: false });
                return null;
            }

            const currentPet = get().pet;
            const updatedPet: PetData | null = currentPet
                ? {
                    ...currentPet,
                    level: result.newLevel,
                    exp: result.newExp,
                    expToNext: result.newExpToNext,
                    mood: result.mood as PetMood,
                }
                : null;

            set({
                pet: updatedPet,
                coins: result.newCoins,
                isLoading: false,
                lastReward: {
                    exp: result.awardedExp,
                    coins: result.awardedCoins,
                    leveledUp: result.leveledUp,
                    newLevel: result.newLevel,
                },
            });
            return result;
        } catch {
            set({ error: 'Không thể đồng bộ phần thưởng.', isLoading: false });
            return null;
        }
    },

    /**
     * Buy a shop item
     */
    buyItem: async (username: string, itemId: string) => {
        set({ isLoading: true, error: null });
        try {
            const result = await gamificationService.buyShopItem(username, itemId);
            if (result) {
                const currentPet = get().pet;
                const updatedPet: PetData | null = currentPet
                    ? { ...currentPet, items: result.items }
                    : null;

                set({
                    pet: updatedPet,
                    coins: result.newCoins,
                    isLoading: false,
                });
                return true;
            }
            set({ error: 'Không thể mua đồ.', isLoading: false });
            return false;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Lỗi khi mua đồ.';
            set({ error: message, isLoading: false });
            return false;
        }
    },

    fetchLeaderboard: async () => {
        try {
            const leaderboard = await gamificationService.getLeaderboard();
            set({ leaderboard });
        } catch {
            console.error('[GamificationStore] Failed to fetch leaderboard');
        }
    },

    fetchTopGoldLeaderboard: async () => {
        try {
            const topGoldLeaderboard = await gamificationService.getTopGoldLeaderboard();
            set({ topGoldLeaderboard });
        } catch {
            console.error('[GamificationStore] Failed to fetch top gold leaderboard');
        }
    },

    /**
     * Clear reward animation state
     */
    clearReward: () => set({ lastReward: null }),

    /**
     * Clear all gamification data (on logout)
     */
    clearGamification: () => {
        set({
            pet: null,
            coins: 0,
            shopItems: [],
            lastReward: null,
            error: null,
        });
    },

    /**
     * Clear error message
     */
    clearError: () => set({ error: null }),
}));

/**
 * Legacy compatibility hook. Persistent gamification data is deliberately removed;
 * callers should hydrate from the authenticated server response instead.
 */
export const restoreGamificationData = () => {
    try { localStorage.removeItem('tohieuquiz_gamification'); } catch { /* no-op */ }
};
