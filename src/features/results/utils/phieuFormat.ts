import { formatSystemDate } from '../../../utils/dateTime';
export function formatPhieuDate(raw: unknown, fallback = '---'): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return formatSystemDate(raw, fallback);
}

export function formatPhieuScore(raw: unknown, fallback = '---'): string {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const score = Number(raw);
  return Number.isFinite(score) ? score.toFixed(1) : fallback;
}
