import { useCallback, useEffect, useState } from 'react';
import { useGamificationStore } from '@/src/stores/useGamificationStore';
import { useGameLoopStore } from '@/src/stores/useGameLoopStore';
import type { GameLoopMission } from '@/src/types/gameLoop.types';
import { getRewardSummary } from '../model';
import { useWeeklyQuests } from './useWeeklyQuests';

export const useStudentRewards = (username?: string) => {
  const pet = useGamificationStore((state) => state.pet);
  const coins = useGamificationStore((state) => state.coins);
  const gameLoop = useGameLoopStore();
  const [isJourneyExpanded, setJourneyExpanded] = useState(false);
  const [claimingMissionId, setClaimingMissionId] = useState<GameLoopMission['id'] | null>(null);
  const weekly = useWeeklyQuests(username, gameLoop.loadDashboard);

  useEffect(() => {
    if (username && !pet) void useGamificationStore.getState().fetchPetData(username);
  }, [pet, username]);
  useEffect(() => {
    if (username) void gameLoop.loadDashboard(username);
  }, [gameLoop.loadDashboard, username]);

  const claimMission = useCallback(async (missionId: GameLoopMission['id']) => {
    if (!username) return;
    setClaimingMissionId(missionId);
    try { await gameLoop.claimMission(username, missionId); }
    finally { setClaimingMissionId(null); }
  }, [gameLoop.claimMission, username]);

  const claimChest = useCallback(async () => {
    if (username) await gameLoop.claimChest(username);
  }, [gameLoop.claimChest, username]);

  return {
    pet, coins, dashboard: gameLoop.dashboard,
    rewardSummary: getRewardSummary(gameLoop.lastReward),
    isLoading: gameLoop.isLoading, errorMessage: gameLoop.error,
    isJourneyExpanded, claimingMissionId,
    weeklyQuests: weekly.quests,
    isWeeklyQuestsLoading: weekly.isLoading,
    weeklyQuestsError: weekly.errorMessage,
    claimingWeeklyQuestId: weekly.claimingId,
    toggleJourney: () => setJourneyExpanded((current) => !current),
    retryDashboard: () => username ? gameLoop.loadDashboard(username) : Promise.resolve(),
    retryWeeklyQuests: weekly.retry,
    claimMission, claimChest, claimWeeklyQuest: weekly.claim,
    clearReward: gameLoop.clearReward,
  };
};

export type StudentRewardsController = ReturnType<typeof useStudentRewards>;
