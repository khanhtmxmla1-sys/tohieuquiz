import { callApi } from './apiAdapter';
import type {
    GameLoopDashboard,
    GameLoopMissionId,
    GameLoopRewardResult,
    TrackQuizActivityInput,
} from '../types/gameLoop.types';

interface ApiEnvelope<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    reward?: GameLoopRewardResult;
}

export interface DashboardResponse {
    dashboard: GameLoopDashboard;
    reward?: GameLoopRewardResult;
}

const unwrap = async <T>(promise: Promise<ApiEnvelope<T>>): Promise<ApiEnvelope<T>> => {
    const response = await promise;
    if (response?.status !== 'success' || !response.data) {
        throw new Error(response?.message || 'Không thể tải dữ liệu game loop.');
    }
    return response;
};

export const gameLoopService = {
    getDashboard: async (username: string): Promise<GameLoopDashboard> => {
        const response = await unwrap(callApi<ApiEnvelope<GameLoopDashboard>>('get_game_loop_dashboard', { username }));
        return response.data as GameLoopDashboard;
    },

    trackQuizActivity: async (payload: TrackQuizActivityInput): Promise<GameLoopDashboard> => {
        const response = await unwrap(callApi<ApiEnvelope<GameLoopDashboard>>('track_game_loop_quiz', payload));
        return response.data as GameLoopDashboard;
    },

    claimMission: async (username: string, missionId: GameLoopMissionId): Promise<DashboardResponse> => {
        const response = await unwrap(callApi<ApiEnvelope<GameLoopDashboard>>('claim_game_loop_mission', {
            username,
            missionId,
        }));
        return {
            dashboard: response.data as GameLoopDashboard,
            reward: response.reward,
        };
    },

    claimChest: async (username: string): Promise<DashboardResponse> => {
        const response = await unwrap(callApi<ApiEnvelope<GameLoopDashboard>>('claim_game_loop_chest', {
            username,
        }));
        return {
            dashboard: response.data as GameLoopDashboard,
            reward: response.reward,
        };
    },
};
