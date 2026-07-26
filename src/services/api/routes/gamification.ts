import type { RouteRegistry } from '../types';

export const gamificationRoutes: RouteRegistry = {
    // Pets
    get_pet_data: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/pets',
        query: ({ username }) => {
            const q = new URLSearchParams();
            q.append('username', username);
            return q;
        },
    },

    // Game state
    update_game_state: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-state',
    },
    claim_result_reward: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-state/result-reward',
    },
    get_attendance_status: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/game-state/attendance-status',
        query: ({ username }) => {
            const q = new URLSearchParams();
            q.append('username', username);
            return q;
        },
    },
    claim_daily_attendance: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-state/attendance-claim',
    },

    // Shop
    buy_shop_item: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/shop/buy',
    },

    // Leaderboard
    get_leaderboard: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/leaderboard',
    },
    get_top_gold_leaderboard: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/leaderboard/top-gold',
    },

    // Game loop
    get_game_loop_dashboard: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/game-loop/dashboard',
    },
    track_game_loop_quiz: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-loop/track-quiz',
    },
    claim_game_loop_mission: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-loop/claim-mission',
    },
    claim_game_loop_chest: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-loop/claim-chest',
    },
    get_weekly_quests: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/game-loop/weekly-quests',
    },
    claim_weekly_quest: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/game-loop/claim-weekly-quest',
    },
};
