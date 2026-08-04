import { useEffect, useState } from 'react';

export const createQuizDeadline = (timeLimitMinutes: number, nowMs = Date.now()): string | null => {
  const minutes = Number(timeLimitMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(nowMs + minutes * 60_000).toISOString();
};

export const remainingSeconds = (expiresAt: string | null, nowMs = Date.now()): number => {
  if (!expiresAt) return 0;
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return 0;
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
};

export const useQuizDeadline = (expiresAt: string | null): number => {
  const [timeLeft, setTimeLeft] = useState(() => remainingSeconds(expiresAt));

  useEffect(() => {
    const update = () => setTimeLeft(remainingSeconds(expiresAt));
    update();
    if (!expiresAt) return undefined;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return timeLeft;
};
