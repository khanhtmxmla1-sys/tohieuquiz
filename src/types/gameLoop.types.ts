export type GameLoopMissionId =
    | 'daily_questions'
    | 'daily_accuracy'
    | 'daily_subject';

export type ChestRewardType =
    | 'COINS'
    | 'COLLECTIBLE'
    | 'HINT_TOKEN'
    | 'STREAK_SHIELD';

export interface GameLoopMission {
    id: GameLoopMissionId;
    title: string;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
    rewardCoins: number;
    unit: string;
}

export interface GameLoopAchievement {
    code: string;
    title: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic';
    unlockedAt: string;
}

export interface GameLoopCollectible {
    id: string;
    title: string;
    icon: string;
}

export interface GameLoopRewardEvent {
    eventType: string;
    rewardType: ChestRewardType;
    payload: Record<string, unknown>;
    createdAt: string;
}

export interface GameLoopDashboard {
    todayDateKey: string;
    wallet: {
        coins: number;
    };
    missions: GameLoopMission[];
    bonusChest: {
        available: boolean;
        claimed: boolean;
    };
    weekly: {
        completedDays: number;
        targetDays: number;
    };
    profile: {
        dailyStreak: number;
        hintTokens: number;
        streakShields: number;
        collection: GameLoopCollectible[];
    };
    achievements: GameLoopAchievement[];
    recentRewards: GameLoopRewardEvent[];
}

export interface GameLoopRewardResult {
    type: ChestRewardType;
    coins?: number;
    amount?: number;
    title?: string;
    icon?: string;
    id?: string;
    missionId?: GameLoopMissionId;
}

export interface TrackQuizActivityInput {
    username: string;
    activityId: string;
    quizId: string;
    category?: string;
    subject?: string;
    correctCount: number;
    totalQuestions: number;
}
