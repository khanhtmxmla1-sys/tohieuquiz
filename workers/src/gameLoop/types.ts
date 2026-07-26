export type MissionId = 'daily_questions' | 'daily_accuracy' | 'daily_subject';
export type RewardType = 'COINS' | 'COLLECTIBLE' | 'HINT_TOKEN' | 'STREAK_SHIELD';

export interface DailyProgressRow {
    username: string;
    progress_date: string;
    questions_answered: number;
    correct_answers: number;
    quizzes_completed: number;
    toan_quizzes_completed: number;
    tieng_viet_quizzes_completed: number;
    mission_questions_claimed: number;
    mission_accuracy_claimed: number;
    mission_subject_claimed: number;
    chest_claimed: number;
    created_at: string;
    updated_at: string;
}

export interface GameProfileRow {
    username: string;
    daily_streak: number;
    last_mission_completion_date: string;
    hint_tokens: number;
    streak_shields: number;
    collection_json: string;
    created_at: string;
    updated_at: string;
}

export interface AchievementRow {
    achievement_code: string;
    unlocked_at: string;
}

export interface DashboardMission {
    id: MissionId;
    title: string;
    description: string;
    target: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
    rewardCoins: number;
    unit: string;
}

export interface CollectibleReward {
    id: string;
    title: string;
    icon: string;
}
