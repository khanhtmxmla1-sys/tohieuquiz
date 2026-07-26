import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { callApi } from '@/src/services/apiAdapter';
import type { WeeklyQuestViewModel } from '@/src/components/HomePage/student-dashboard';

export const useWeeklyQuests = (
  username: string | undefined,
  refreshDashboard: (username: string) => Promise<void>,
) => {
  const [quests, setQuests] = useState<WeeklyQuestViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchQuests = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await callApi('get_weekly_quests', {});
      if (data.status === 'success' && Array.isArray(data.quests)) {
        setQuests(data.quests);
        return;
      }
      throw new Error(data.message || 'Không thể tải nhiệm vụ tuần');
    } catch (error) {
      console.error('Error fetching weekly quests:', error);
      setErrorMessage('Không thể tải nhiệm vụ tuần');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useEffect(() => { void fetchQuests(); }, [fetchQuests]);

  const claim = useCallback(async (questId: string) => {
    if (!username) return;
    setClaimingId(questId);
    try {
      const data = await callApi('claim_weekly_quest', { questId });
      if (data.status === 'success') {
        toast.success(`🎉 Nhận thưởng thành công! +${data.reward.coins} xu`);
        await fetchQuests();
        if (data.data) await refreshDashboard(username);
      }
    } catch (error) {
      console.error('Error claiming weekly quest:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể nhận thưởng');
    } finally {
      setClaimingId(null);
    }
  }, [fetchQuests, refreshDashboard, username]);

  return { quests, isLoading, errorMessage, claimingId, retry: fetchQuests, claim };
};
