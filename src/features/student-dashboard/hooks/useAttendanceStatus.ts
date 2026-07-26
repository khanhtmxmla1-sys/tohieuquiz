import { useEffect, useMemo, useState } from 'react';
import { callApi } from '@/src/services/apiAdapter';
import { getLocalDateKey, type AttendanceStatusData } from '../model';

export const useAttendanceStatus = (username?: string) => {
  const [claimedToday, setClaimedToday] = useState(false);
  const [claimDates, setClaimDates] = useState<string[]>([]);
  const todayKey = useMemo(() => getLocalDateKey(), [username]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!username) {
        if (!cancelled) { setClaimedToday(false); setClaimDates([]); }
        return;
      }
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
          return;
        }
      } catch (error) {
        console.error('Failed to load attendance status:', error);
      }
      if (!cancelled) { setClaimedToday(false); setClaimDates([]); }
    };
    void load();
    return () => { cancelled = true; };
  }, [todayKey, username]);

  return { claimedToday, claimDates, setClaimedToday, setClaimDates };
};
