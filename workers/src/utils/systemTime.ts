import {
  SYSTEM_LOCALE,
  SYSTEM_TIME_ZONE,
  SYSTEM_UTC_OFFSET,
} from '../../../shared/time-zone.contract';

export type SystemTimeInput = Date | string | number;

export interface SystemDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  dateKey: string;
}

const DAY_MS = 86_400_000;
const systemPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SYSTEM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const parseSystemDate = (value: SystemTimeInput): Date | null => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const formatDateKeyFromUtcLabel = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKeyLabel = (dateKey: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) throw new Error('Ngày hệ thống không hợp lệ');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (!Number.isFinite(date.getTime()) || formatDateKeyFromUtcLabel(date) !== dateKey) {
    throw new Error('Ngày hệ thống không hợp lệ');
  }
  return date;
};

export const getSystemDateTimeParts = (value: SystemTimeInput = new Date()): SystemDateTimeParts => {
  const date = parseSystemDate(value);
  if (!date) throw new Error('Thời gian không hợp lệ');
  const values = Object.fromEntries(
    systemPartsFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const weekday = parseDateKeyLabel(dateKey).getUTCDay() || 7;
  return {
    year,
    month,
    day,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
    dateKey,
  };
};

const getPartsOrNull = (value: SystemTimeInput): SystemDateTimeParts | null => {
  try {
    return getSystemDateTimeParts(value);
  } catch {
    return null;
  }
};

export const formatSystemDate = (
  value: SystemTimeInput,
  fallback = 'Không rõ ngày',
): string => {
  const parts = getPartsOrNull(value);
  return parts
    ? `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`
    : fallback;
};

export const formatSystemTime = (
  value: SystemTimeInput,
  fallback = 'Không rõ giờ',
): string => {
  const parts = getPartsOrNull(value);
  return parts
    ? `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
    : fallback;
};

export const formatSystemDateTime = (
  value: SystemTimeInput,
  fallback = 'Không rõ thời gian',
): string => {
  const parts = getPartsOrNull(value);
  return parts
    ? `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
    : fallback;
};

export const formatSystemDateLong = (
  value: SystemTimeInput,
  fallback = 'Không rõ ngày',
): string => {
  const parts = getPartsOrNull(value);
  return parts
    ? `${String(parts.day).padStart(2, '0')} tháng ${String(parts.month).padStart(2, '0')}, ${parts.year}`
    : fallback;
};

export const formatSystemDateWithOptions = (
  value: SystemTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback = 'Không rõ ngày',
): string => {
  const date = parseSystemDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(SYSTEM_LOCALE, {
    ...options,
    timeZone: SYSTEM_TIME_ZONE,
    hourCycle: options.hourCycle ?? 'h23',
  }).format(date);
};

export const getSystemDateKey = (
  value: SystemTimeInput = new Date(),
): string => getSystemDateTimeParts(value).dateKey;

export const addSystemCalendarDays = (dateKey: string, days: number): string => {
  const date = parseDateKeyLabel(dateKey);
  if (!Number.isInteger(days)) throw new Error('Số ngày không hợp lệ');
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKeyFromUtcLabel(date);
};

const isoWeekFromDateKey = (dateKey: string): string => {
  const date = parseDateKeyLabel(dateKey);
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
};

export const getSystemWeekKey = (
  value: SystemTimeInput = new Date(),
): string => isoWeekFromDateKey(getSystemDateKey(value));

const getIsoWeekStartDateKey = (weekKey: string): string => {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekKey || '').trim());
  if (!match) throw new Error('Tuần ISO không hợp lệ');
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isInteger(week) || week < 1 || week > 53) {
    throw new Error('Tuần ISO không hợp lệ');
  }
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1 + (week - 1) * 7);
  const dateKey = formatDateKeyFromUtcLabel(januaryFourth);
  if (isoWeekFromDateKey(dateKey) !== weekKey) throw new Error('Tuần ISO không hợp lệ');
  return dateKey;
};

export const getSystemDayUtcRange = (
  value: SystemTimeInput = new Date(),
): { start: string; end: string } => {
  const dateKey = getSystemDateKey(value);
  const start = new Date(`${dateKey}T00:00:00${SYSTEM_UTC_OFFSET}`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + DAY_MS).toISOString(),
  };
};

export const getSystemWeekUtcRange = (weekKey: string): {
  startDateKey: string;
  endDateKey: string;
  startIso: string;
  endIsoExclusive: string;
} => {
  const startDateKey = getIsoWeekStartDateKey(weekKey);
  const endDateKey = addSystemCalendarDays(startDateKey, 6);
  const start = new Date(`${startDateKey}T00:00:00${SYSTEM_UTC_OFFSET}`);
  return {
    startDateKey,
    endDateKey,
    startIso: start.toISOString(),
    endIsoExclusive: new Date(start.getTime() + 7 * DAY_MS).toISOString(),
  };
};

export const getSystemDeadlineIso = (
  days: number,
  now: SystemTimeInput = new Date(),
): string => {
  if (!Number.isInteger(days) || days < 0) throw new Error('Số ngày không hợp lệ');
  const deadlineDateKey = addSystemCalendarDays(getSystemDateKey(now), days);
  return new Date(`${deadlineDateKey}T23:59:00${SYSTEM_UTC_OFFSET}`).toISOString();
};
