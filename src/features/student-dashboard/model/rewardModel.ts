import type { GameLoopRewardResult } from '@/src/types/gameLoop.types';

export interface RewardSummary {
  icon: string;
  title: string;
  description: string;
}

export const getRewardSummary = (
  reward: GameLoopRewardResult | null,
): RewardSummary | null => {
  if (!reward) return null;
  if (reward.type === 'COINS') return {
    icon: reward.icon || '🪙', title: reward.title || 'Thưởng xu',
    description: `Em nhận thêm +${reward.coins || 0} Xu.`,
  };
  if (reward.type === 'COLLECTIBLE') return {
    icon: reward.icon || '🎁', title: reward.title || 'Vật phẩm sưu tầm',
    description: 'Một món sưu tầm mới đã được thêm vào bộ sưu tập của em.',
  };
  if (reward.type === 'HINT_TOKEN') return {
    icon: reward.icon || '💡', title: reward.title || 'Vé gợi ý',
    description: `Em nhận thêm ${reward.amount || 0} vé gợi ý cho những bài khó.`,
  };
  return {
    icon: reward.icon || '🛡️', title: reward.title || 'Khiên giữ chuỗi',
    description: `Em nhận thêm ${reward.amount || 0} khiên để bảo vệ chuỗi học tập.`,
  };
};
