import { create } from 'zustand';
import { useGamificationStore } from './useGamificationStore';
import { gameLoopService } from '../services/gameLoop.service';
import type {
    GameLoopDashboard,
    GameLoopMissionId,
    GameLoopRewardResult,
    TrackQuizActivityInput,
} from '../types/gameLoop.types';

interface GameLoopStore {
    dashboard: GameLoopDashboard | null;
    lastReward: GameLoopRewardResult | null;
    isLoading: boolean;
    error: string | null;
    loadDashboard: (username: string) => Promise<void>;
    trackQuizActivity: (payload: TrackQuizActivityInput) => Promise<void>;
    claimMission: (username: string, missionId: GameLoopMissionId) => Promise<boolean>;
    claimChest: (username: string) => Promise<boolean>;
    clearReward: () => void;
    clear: () => void;
}

const syncWalletCoins = (coins: number) => {
    useGamificationStore.setState((state) => ({
        ...state,
        coins,
    }));
};

export const useGameLoopStore = create<GameLoopStore>((set) => ({
    dashboard: null,
    lastReward: null,
    isLoading: false,
    error: null,

    loadDashboard: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
            const dashboard = await gameLoopService.getDashboard(username);
            syncWalletCoins(dashboard.wallet.coins);
            set({ dashboard, isLoading: false });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Không thể tải hành trình học tập.',
            });
        }
    },

    trackQuizActivity: async (payload: TrackQuizActivityInput) => {
        try {
            const dashboard = await gameLoopService.trackQuizActivity(payload);
            syncWalletCoins(dashboard.wallet.coins);
            set({ dashboard, error: null });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Không thể cập nhật tiến độ nhiệm vụ.',
            });
        }
    },

    claimMission: async (username: string, missionId: GameLoopMissionId) => {
        set({ isLoading: true, error: null });
        try {
            const { dashboard, reward } = await gameLoopService.claimMission(username, missionId);
            syncWalletCoins(dashboard.wallet.coins);
            set({ dashboard, lastReward: reward || null, isLoading: false });
            return true;
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Không thể nhận thưởng nhiệm vụ.',
            });
            return false;
        }
    },

    claimChest: async (username: string) => {
        set({ isLoading: true, error: null });
        try {
            const { dashboard, reward } = await gameLoopService.claimChest(username);
            syncWalletCoins(dashboard.wallet.coins);
            set({ dashboard, lastReward: reward || null, isLoading: false });
            return true;
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Không thể mở rương thưởng.',
            });
            return false;
        }
    },

    clearReward: () => set({ lastReward: null }),

    clear: () => set({
        dashboard: null,
        lastReward: null,
        isLoading: false,
        error: null,
    }),
}));
