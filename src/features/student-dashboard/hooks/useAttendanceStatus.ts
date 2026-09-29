import { useEffect, useState } from 'react';
import { callApi } from '@/src/services/apiAdapter';
import { systemDateTimeLocalToIso } from '@/src/utils/dateTime';
import {
  getLocalDateKey, type AttendanceAttemptSummary, type AttendanceRewardPreview,
  type AttendanceStatusData,
} from '../model';

const getDelayUntilNextSystemDay = () => {
  const [year, month, day] = getLocalDateKey().split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const nextMidnight = Date.parse(systemDateTimeLocalToIso(`${tomorrowKey}T00:00`));
  return Math.max(100, nextMidnight - Date.now() + 25);
};

export const useAttendanceStatus = (username?: string) => {
  const [claimedToday, setClaimedToday] = useState(false);
  const [claimDates, setClaimDates] = useState<string[]>([]);
  const [statusAvailable, setStatusAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [attempt, setAttempt] = useState<AttendanceAttemptSummary | null>(null);
  const [rewardPreview, setRewardPreview] = useState<AttendanceRewardPreview | null>(null);
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let rolloverTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshDateKey = () => {
      const nextKey = getLocalDateKey();
      setTodayKey((currentKey) => currentKey === nextKey ? currentKey : nextKey);
    };
    const scheduleRollover = () => {
      if (rolloverTimer) clearTimeout(rolloverTimer);
      rolloverTimer = setTimeout(() => {
        refreshDateKey();
        scheduleRollover();
      }, getDelayUntilNextSystemDay());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      refreshDateKey();
      setRefreshVersion((version) => version + 1);
      scheduleRollover();
    };

    scheduleRollover();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (rolloverTimer) clearTimeout(rolloverTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reset = () => {
      setClaimedToday(false);
      setClaimDates([]);
      setEnabled(false);
      setAvailable(false);
      setQuestionCount(0);
      setAttempt(null);
      setRewardPreview(null);
      setStatusAvailable(false);
    };

    const load = async () => {
      if (!username) {
        if (!cancelled) reset();
        return;
      }
      if (!cancelled) setStatusAvailable(false);
      try {
        const response = await callApi<{
          status: 'success' | 'error'; data?: AttendanceStatusData; message?: string;
        }>('get_attendance_status', { username });
        if (!cancelled && response?.status === 'success' && response.data) {
          const dates = Array.isArray(response.data.claimDates)
            ? Array.from(new Set(response.data.claimDates
              .map((date) => String(date || '').trim()).filter(Boolean))) : [];
          setClaimDates(dates);
          setClaimedToday(Boolean(response.data.claimedToday));
          setEnabled(Boolean(response.data.enabled));
          setAvailable(Boolean(response.data.available));
          setQuestionCount(Math.max(0, Number(response.data.questionCount) || 0));
          setAttempt(response.data.attempt ?? null);
          setRewardPreview({
            attendanceDayNumber: Number(response.data.attendanceDayNumber) || 1,
            nextRewardExp: Math.max(0, Number(response.data.nextRewardExp) || 0),
            nextRewardCoins: Math.max(0, Number(response.data.nextRewardCoins) || 0),
          });
          setStatusAvailable(true);
          return;
        }
      } catch (error) {
        console.error('Failed to load attendance status:', error);
      }
      if (!cancelled) reset();
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshVersion, todayKey, username]);

  return {
    claimedToday, claimDates, statusAvailable, enabled, available, questionCount, attempt,
    rewardPreview, setClaimedToday, setClaimDates, setAttempt,
  };
};
