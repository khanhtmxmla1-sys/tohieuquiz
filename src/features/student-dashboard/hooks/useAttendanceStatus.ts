import { useEffect, useState } from 'react';
import { callApi } from '@/src/services/apiAdapter';
import { systemDateTimeLocalToIso } from '@/src/utils/dateTime';
import {
  getLocalDateKey, type AttendanceRewardPreview, type AttendanceStatusData,
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
    const load = async () => {
      if (!username) {
        if (!cancelled) {
          setClaimedToday(false);
          setClaimDates([]);
          setRewardPreview(null);
          setStatusAvailable(false);
        }
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
      if (!cancelled) {
        setClaimedToday(false);
        setClaimDates([]);
        setRewardPreview(null);
        setStatusAvailable(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshVersion, todayKey, username]);

  return {
    claimedToday, claimDates, statusAvailable, rewardPreview,
    setClaimedToday, setClaimDates,
  };
};
