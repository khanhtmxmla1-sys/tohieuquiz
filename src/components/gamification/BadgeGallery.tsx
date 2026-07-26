import React, { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Lock, Trophy, Star } from 'lucide-react';
import type { GameLoopAchievement } from '../../types/gameLoop.types';
import { ACHIEVEMENT_DEFINITIONS } from '../../config/achievementDefinitions';
import { getAchievementBadgeAlt, getAchievementBadgeImage } from '../../config/achievementBadges';

interface BadgeGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    achievements: GameLoopAchievement[];
    allAchievements?: typeof ACHIEVEMENT_DEFINITIONS;
}

const RARITY_COLORS = {
    common: {
        bg: 'bg-slate-100',
        border: 'border-slate-300',
        text: 'text-slate-700',
        glow: 'shadow-slate-200',
    },
    rare: {
        bg: 'bg-blue-100',
        border: 'border-blue-400',
        text: 'text-blue-700',
        glow: 'shadow-blue-300',
    },
    epic: {
        bg: 'bg-purple-100',
        border: 'border-purple-500',
        text: 'text-blue-800',
        glow: 'shadow-purple-400',
    },
};

export const BadgeGallery: React.FC<BadgeGalleryProps> = ({
    isOpen,
    onClose,
    achievements,
}) => {
    const prefersReducedMotion = useReducedMotion();
    const modalTransition = {
        duration: prefersReducedMotion ? 0.01 : 0.2,
        ease: 'easeOut' as const,
    };

    const unlockedCodes = useMemo(() => {
        return new Set(achievements.map(a => a.code));
    }, [achievements]);

    const badgesByCategory = useMemo(() => {
        return {
            streak: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.startsWith('streak_')),
            subject: ACHIEVEMENT_DEFINITIONS.filter(a => 
                a.code.includes('math_') || a.code.includes('vietnamese_') || a.code.includes('english_')
            ),
            speed: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.includes('speed_')),
            perfect: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.includes('perfect_')),
            time: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.includes('early_') || a.code.includes('night_')),
            collection: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.includes('collector_')),
            questions: ACHIEVEMENT_DEFINITIONS.filter(a => a.code.includes('questions_')),
            mission: ACHIEVEMENT_DEFINITIONS.filter(a => 
                a.code === 'first_quiz' || a.code === 'daily_hat_trick' || a.code === 'weekly_warrior'
            ),
        };
    }, []);

    const stats = useMemo(() => {
        const total = ACHIEVEMENT_DEFINITIONS.length;
        const unlocked = achievements.length;
        const byRarity = {
            common: achievements.filter(a => a.rarity === 'common').length,
            rare: achievements.filter(a => a.rarity === 'rare').length,
            epic: achievements.filter(a => a.rarity === 'epic').length,
        };
        return { total, unlocked, byRarity };
    }, [achievements]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={modalTransition}
                className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm p-4 flex items-center justify-center"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 1, scale: 0.98, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 12 }}
                    transition={modalTransition}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="badge-gallery-title"
                    data-motion-duration-ms="200"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="border-b border-slate-200 bg-slate-50 p-6 text-slate-900">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl">
                                    <Trophy />
                                </div>
                                <div>
                                    <h2 id="badge-gallery-title" className="text-2xl font-black">Bộ sưu tập huy hiệu</h2>
                                    <p className="text-sm text-slate-600">
                                        {stats.unlocked}/{stats.total} huy hiệu đã mở khóa
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Đóng bộ sưu tập huy hiệu"
                                className="w-11 h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-100 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Progress bar */}
                        <div
                            role="progressbar"
                            aria-label="Tiến độ mở khóa huy hiệu"
                            aria-valuemin={0}
                            aria-valuemax={stats.total}
                            aria-valuenow={stats.unlocked}
                            className="relative h-3 bg-slate-200 rounded-full overflow-hidden"
                        >
                            <div
                                data-testid="badge-gallery-progress-fill"
                                className="absolute inset-y-0 left-0 right-0 origin-left bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-transform duration-200 motion-reduce:transition-none"
                                style={{ transform: `scaleX(${stats.total > 0 ? stats.unlocked / stats.total : 0})` }}
                            />
                        </div>

                        {/* Rarity stats */}
                        <div className="flex gap-4 mt-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-300" />
                                <span>Common: {stats.byRarity.common}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-400" />
                                <span>Rare: {stats.byRarity.rare}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-400" />
                                <span>Epic: {stats.byRarity.epic}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {Object.entries(badgesByCategory).map(([category, badges]) => (
                            <div key={category}>
                                <h3 className="text-lg font-black text-slate-800 mb-4 capitalize flex items-center gap-2">
                                    <Star className="w-5 h-5 text-amber-500" />
                                    {category === 'streak' && '🔥 Chuỗi học tập'}
                                    {category === 'subject' && '🧮 Bậc thầy môn học'}
                                    {category === 'speed' && '⚡ Tốc độ'}
                                    {category === 'perfect' && '💯 Điểm tuyệt đối'}
                                    {category === 'time' && '🌅 Thời gian'}
                                    {category === 'collection' && '🎁 Sưu tầm'}
                                    {category === 'questions' && '📝 Tổng câu hỏi'}
                                    {category === 'mission' && '🎯 Nhiệm vụ'}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {badges.map((badge) => {
                                        const isUnlocked = unlockedCodes.has(badge.code);
                                        const colors = RARITY_COLORS[badge.rarity as keyof typeof RARITY_COLORS];
                                        const unlockedData = achievements.find(a => a.code === badge.code);
                                        const badgeImage = getAchievementBadgeImage(badge.code);

                                        return (
                                            <motion.div
                                                key={badge.code}
                                                whileHover={!prefersReducedMotion && isUnlocked ? { scale: 1.03, y: -2 } : {}}
                                                transition={modalTransition}
                                                className={`relative rounded-2xl border-2 p-4 transition-transform duration-200 motion-reduce:transition-none ${
                                                    isUnlocked
                                                        ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                                                        : 'bg-slate-50 border-slate-200 opacity-50'
                                                }`}
                                            >
                                                {/* Badge icon */}
                                                <div className="mb-2 flex justify-center text-center relative">
                                                    {badgeImage ? (
                                                        <div className="relative inline-flex">
                                                            <img
                                                                src={badgeImage}
                                                                alt={getAchievementBadgeAlt(badge)}
                                                                className={`h-16 w-16 object-contain drop-shadow-sm ${isUnlocked ? '' : 'opacity-30 grayscale'}`}
                                                            />
                                                            {!isUnlocked && <Lock className="absolute inset-0 m-auto w-6 h-6 text-slate-400" />}
                                                        </div>
                                                    ) : isUnlocked ? (
                                                        <span className="text-4xl">{badge.icon}</span>
                                                    ) : (
                                                        <div className="relative">
                                                            <span className="opacity-30 text-4xl">{badge.icon}</span>
                                                            <Lock className="absolute inset-0 m-auto w-6 h-6 text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Badge info */}
                                                <div className="text-center">
                                                    <h4 className={`text-sm font-black mb-1 ${isUnlocked ? colors.text : 'text-slate-500'}`}>
                                                        {badge.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 line-clamp-2">
                                                        {badge.description}
                                                    </p>
                                                    {isUnlocked && unlockedData?.unlockedAt && (
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            {new Date(unlockedData.unlockedAt).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Rarity indicator */}
                                                {isUnlocked && (
                                                    <div className="absolute top-2 right-2">
                                                        <div className={`w-2 h-2 rounded-full ${
                                                            badge.rarity === 'common' ? 'bg-slate-400' :
                                                            badge.rarity === 'rare' ? 'bg-blue-500' :
                                                            'bg-purple-600'
                                                        }`} />
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BadgeGallery;
