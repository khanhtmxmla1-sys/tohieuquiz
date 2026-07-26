export const ACHIEVEMENT_DEFINITIONS = [
    { code: 'streak_3', title: 'Kiên trì 3 ngày', description: 'Học liên tục 3 ngày không nghỉ.', icon: '🔥', rarity: 'common' },
    { code: 'streak_7', title: 'Kiên trì 7 ngày', description: 'Học liên tục 7 ngày không nghỉ.', icon: '🔥', rarity: 'common' },
    { code: 'streak_30', title: 'Siêu kiên trì', description: 'Học liên tục 30 ngày không nghỉ.', icon: '🔥🔥', rarity: 'rare' },
    { code: 'streak_100', title: 'Huyền thoại', description: 'Học liên tục 100 ngày không nghỉ.', icon: '👑', rarity: 'epic' },

    { code: 'math_expert_50', title: 'Cao thủ Toán', description: 'Làm đúng 50 câu Toán với điểm >= 80%.', icon: '🧮', rarity: 'common' },
    { code: 'math_expert_100', title: 'Bậc thầy Toán', description: 'Làm đúng 100 câu Toán với điểm >= 80%.', icon: '🧮', rarity: 'rare' },
    { code: 'vietnamese_expert_50', title: 'Cao thủ Tiếng Việt', description: 'Làm đúng 50 câu Tiếng Việt với điểm >= 80%.', icon: '📚', rarity: 'common' },
    { code: 'english_expert_50', title: 'Bậc thầy Tiếng Anh', description: 'Làm đúng 50 câu Tiếng Anh với điểm >= 80%.', icon: '🇬🇧', rarity: 'common' },

    { code: 'speed_demon_10', title: 'Tốc độ ánh sáng', description: 'Hoàn thành bài trong < 50% thời gian 10 lần.', icon: '⚡', rarity: 'rare' },
    { code: 'speed_master_30', title: 'Bậc thầy tốc độ', description: 'Hoàn thành bài trong < 50% thời gian 30 lần.', icon: '⚡⚡', rarity: 'epic' },

    { code: 'perfect_5', title: 'Điểm 10 liên tiếp', description: 'Đạt 100% điểm 5 lần liên tiếp.', icon: '💯', rarity: 'rare' },
    { code: 'perfect_20', title: 'Thần đồng', description: 'Đạt 100% điểm 20 lần.', icon: '🌟', rarity: 'epic' },

    { code: 'early_bird_10', title: 'Chim sớm', description: 'Làm bài trước 7h sáng 10 lần.', icon: '🌅', rarity: 'common' },
    { code: 'night_owl_10', title: 'Cú đêm', description: 'Làm bài sau 9h tối 10 lần.', icon: '🦉', rarity: 'common' },

    { code: 'collector_5', title: 'Nhà sưu tập', description: 'Sở hữu 5 vật phẩm sưu tầm.', icon: '🎁', rarity: 'common' },
    { code: 'collector_10', title: 'Đại gia sưu tầm', description: 'Sở hữu 10 vật phẩm sưu tầm.', icon: '🎁', rarity: 'rare' },

    { code: 'questions_100', title: 'Trăm câu', description: 'Trả lời đúng 100 câu hỏi.', icon: '📝', rarity: 'common' },
    { code: 'questions_500', title: 'Năm trăm câu', description: 'Trả lời đúng 500 câu hỏi.', icon: '📚', rarity: 'rare' },
    { code: 'questions_1000', title: 'Nghìn câu', description: 'Trả lời đúng 1000 câu hỏi.', icon: '🏆', rarity: 'epic' },

    { code: 'first_quiz', title: 'Bắt đầu hành trình', description: 'Hoàn thành bài quiz đầu tiên.', icon: '🚀', rarity: 'common' },
    { code: 'daily_hat_trick', title: 'Trọn bộ nhiệm vụ', description: 'Hoàn thành đủ 3 nhiệm vụ trong một ngày.', icon: '🎯', rarity: 'rare' },
    { code: 'weekly_warrior', title: 'Chiến binh tuần lễ', description: 'Hoàn thành nhiệm vụ 7 ngày liên tiếp.', icon: '⚔️', rarity: 'epic' },

    { code: 'weekly_champion_1st', title: 'Vô địch tuần', description: 'Đạt hạng 1 bảng xếp hạng tuần.', icon: '👑', rarity: 'epic' },
    { code: 'weekly_champion_2nd', title: 'Á quân tuần', description: 'Đạt hạng 2 bảng xếp hạng tuần.', icon: '🥈', rarity: 'rare' },
    { code: 'weekly_champion_3rd', title: 'Hạng 3 tuần', description: 'Đạt hạng 3 bảng xếp hạng tuần.', icon: '🥉', rarity: 'rare' },
] as const;

export type AchievementDefinition = (typeof ACHIEVEMENT_DEFINITIONS)[number];