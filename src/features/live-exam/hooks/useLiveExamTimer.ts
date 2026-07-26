/**
 * useLiveExamTimer Hook
 *
 * Client-side countdown timer for live exams.
 * Syncs with server-provided end time.
 *
 * Related: ADR-0001 (Polling)
 */

import { useState, useEffect, useRef } from 'react';

interface UseLiveExamTimerOptions {
    endsAt: string | null; // ISO 8601 timestamp
    onExpire?: () => void; // Callback when timer expires
}

interface UseLiveExamTimerReturn {
    timeRemaining: number; // Seconds remaining
    formattedTime: string; // "MM:SS" format
    isExpired: boolean;
    progress: number; // 0-100 percentage
}

export function useLiveExamTimer({
    endsAt,
    onExpire,
}: UseLiveExamTimerOptions): UseLiveExamTimerReturn {
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isExpired, setIsExpired] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasCalledExpireRef = useRef(false);
    const initialTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (!endsAt) {
            setTimeRemaining(0);
            setIsExpired(false);
            return;
        }

        const calculateTimeRemaining = () => {
            const now = Date.now();
            const end = new Date(endsAt).getTime();
            const remaining = Math.max(0, Math.floor((end - now) / 1000));

            if (initialTimeRef.current === null && remaining > 0) {
                initialTimeRef.current = remaining;
            }

            setTimeRemaining(remaining);

            if (remaining === 0 && !hasCalledExpireRef.current) {
                setIsExpired(true);
                hasCalledExpireRef.current = true;
                if (onExpire) {
                    onExpire();
                }
            }

            return remaining;
        };

        calculateTimeRemaining();

        intervalRef.current = setInterval(() => {
            const remaining = calculateTimeRemaining();
            if (remaining === 0 && intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [endsAt, onExpire]);

    const formattedTime = formatTime(timeRemaining);

    const progress = initialTimeRef.current
        ? Math.max(0, Math.min(100, ((initialTimeRef.current - timeRemaining) / initialTimeRef.current) * 100))
        : 0;

    return {
        timeRemaining,
        formattedTime,
        isExpired,
        progress,
    };
}

function formatTime(seconds: number): string {
    if (seconds <= 0) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
