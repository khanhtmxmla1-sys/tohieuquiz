export function formatPhieuDate(raw: unknown, fallback = '---'): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('vi-VN');
}

export function formatPhieuScore(raw: unknown, fallback = '---'): string {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const score = Number(raw);
  return Number.isFinite(score) ? score.toFixed(1) : fallback;
}
