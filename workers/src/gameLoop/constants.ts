import { ACHIEVEMENT_DEFINITIONS } from '../../../src/config/achievementDefinitions';

export const DAILY_MISSIONS = [
    {
        id: 'daily_questions' as const,
        title: 'Tia chớp câu hỏi',
        description: 'Hoàn thành 15 câu hỏi trong hôm nay.',
        target: 15, rewardCoins: 30, unit: 'câu',
    },
    {
        id: 'daily_accuracy' as const,
        title: 'Ngắm chuẩn mục tiêu',
        description: 'Giữ độ chính xác từ 80% với ít nhất 10 câu.',
        target: 80, rewardCoins: 40, unit: '%',
    },
    {
        id: 'daily_subject' as const,
        title: 'Chinh phục môn chính',
        description: 'Hoàn thành ít nhất 1 bài Toán hoặc Tiếng Việt.',
        target: 1, rewardCoins: 35, unit: 'bài',
    },
] as const;

export const COLLECTIBLE_REWARDS = [
    { id: 'sticker_toan_star', title: 'Sticker Sao Toán', icon: '⭐' },
    { id: 'sticker_tv_book', title: 'Sticker Sách Việt', icon: '📘' },
    { id: 'sticker_bee_crown', title: 'Sticker Ong Vương Miện', icon: '🐝' },
    { id: 'sticker_rainbow_pen', title: 'Sticker Bút Cầu Vồng', icon: '🖍️' },
] as const;

export const WEEKLY_QUESTS = [
    {
        id: 'weekly_20_quizzes', title: 'Hoàn thành 20 bài quiz',
        description: 'Làm xong 20 bài quiz bất kỳ trong tuần này.', target: 20,
        reward: { coins: 200, items: ['hint_token'], itemCount: 1 }, icon: '📚',
    },
    {
        id: 'weekly_top_5', title: 'Đạt top 5 lớp',
        description: 'Lọt vào top 5 bảng xếp hạng lớp học.', target: 1,
        reward: { coins: 300, items: ['streak_shield'], itemCount: 1 }, icon: '🏆',
    },
    {
        id: 'weekly_100_correct', title: 'Trả lời đúng 100 câu',
        description: 'Tích lũy 100 câu trả lời đúng trong tuần.', target: 100,
        reward: { coins: 150, items: [], itemCount: 0 }, icon: '✅',
    },
    {
        id: 'weekly_subject_master', title: 'Chinh phục 3 môn',
        description: 'Hoàn thành ít nhất 1 bài Toán, Tiếng Việt và Tiếng Anh.', target: 3,
        reward: { coins: 250, items: ['pet_accessory_random'], itemCount: 1 }, icon: '🎯',
    },
    {
        id: 'weekly_perfect_streak', title: 'Chuỗi hoàn hảo',
        description: 'Đạt 100% điểm trong 3 bài quiz.', target: 3,
        reward: { coins: 400, items: ['hint_token', 'streak_shield'], itemCount: 2 }, icon: '💯',
    },
] as const;

export const ACHIEVEMENTS = ACHIEVEMENT_DEFINITIONS;
