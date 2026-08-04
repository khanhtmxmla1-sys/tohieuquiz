import {
  SYSTEM_LOCALE,
  SYSTEM_TIME_ZONE,
  SYSTEM_UTC_OFFSET,
} from '../../shared/time-zone.contract';

export type SystemTimeInput = Date | string | number;

const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

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

const getSystemParts = (value: SystemTimeInput) => {
  const date = parseSystemDate(value);
  if (!date) return null;
  const parts = Object.fromEntries(
    systemPartsFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
    hour: String(parts.hour),
    minute: String(parts.minute),
    second: String(parts.second),
  };
};

const formatWithOptions = (
  value: SystemTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
): string => {
  const date = parseSystemDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(SYSTEM_LOCALE, {
    ...options,
    timeZone: SYSTEM_TIME_ZONE,
    hourCycle: options.hourCycle ?? 'h23',
  }).format(date);
};

export const formatSystemDate = (
  value: SystemTimeInput,
  fallback = 'Không rõ ngày',
): string => {
  const parts = getSystemParts(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : fallback;
};

export const formatSystemTime = (
  value: SystemTimeInput,
  fallback = 'Không rõ giờ',
): string => {
  const parts = getSystemParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : fallback;
};

export const formatSystemDateTime = (
  value: SystemTimeInput,
  fallback = 'Không rõ thời gian',
): string => {
  const parts = getSystemParts(value);
  return parts
    ? `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
    : fallback;
};

export const formatSystemDateLong = (
  value: SystemTimeInput,
  fallback = 'Không rõ ngày',
): string => {
  const parts = getSystemParts(value);
  return parts ? `${parts.day} tháng ${parts.month}, ${parts.year}` : fallback;
};

export const formatSystemDateWithOptions = (
  value: SystemTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback = 'Không rõ ngày',
): string => formatWithOptions(value, options, fallback);

export const formatSystemTimeWithOptions = (
  value: SystemTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback = 'Không rõ giờ',
): string => formatWithOptions(value, options, fallback);

export const formatSystemDateTimeWithOptions = (
  value: SystemTimeInput,
  options: Intl.DateTimeFormatOptions,
  fallback = 'Không rõ thời gian',
): string => formatWithOptions(value, options, fallback);

export const getSystemDateKey = (
  value: SystemTimeInput = new Date(),
): string => {
  const parts = getSystemParts(value);
  if (!parts) throw new Error('Thời gian không hợp lệ');
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const isoWeekFromDateKey = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
};

export const getSystemWeekKey = (
  value: SystemTimeInput = new Date(),
): string => isoWeekFromDateKey(getSystemDateKey(value));

export const toSystemDateTimeLocal = (value: SystemTimeInput): string => {
  const parts = getSystemParts(value);
  if (!parts) throw new Error('Thời hạn không hợp lệ');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const systemDateTimeLocalToIso = (value: string): string => {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) throw new Error('Thời hạn không hợp lệ');
  const date = new Date(`${value}:00${SYSTEM_UTC_OFFSET}`);
  if (!Number.isFinite(date.getTime())) throw new Error('Thời hạn không hợp lệ');

  const [, year, month, day, hour, minute] = match;
  if (toSystemDateTimeLocal(date) !== `${year}-${month}-${day}T${hour}:${minute}`) {
    throw new Error('Thời hạn không hợp lệ');
  }
  return date.toISOString();
};

export const getSystemDefaultDeadline = (days = 7, now = new Date()): string => {
  const parts = getSystemParts(now);
  if (!parts) throw new Error('Thời hạn không hợp lệ');
  const deadline = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day) + days,
    16,
    59,
    0,
    0,
  ));
  return toSystemDateTimeLocal(deadline);
};

/** @deprecated Use toSystemDateTimeLocal. */
export const toVietnamDateTimeLocal = toSystemDateTimeLocal;
/** @deprecated Use systemDateTimeLocalToIso. */
export const vietnamDateTimeLocalToIso = systemDateTimeLocalToIso;
/** @deprecated Use getSystemDefaultDeadline. */
export const getVietnamDefaultDeadline = getSystemDefaultDeadline;
