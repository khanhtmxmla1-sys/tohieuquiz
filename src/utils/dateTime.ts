const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VIETNAM_OFFSET = '+07:00';
const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const getVietnamParts = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Thời hạn không hợp lệ');
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const pad = (value: number) => String(value).padStart(2, '0');

export const toVietnamDateTimeLocal = (value: Date | string): string => {
  const parts = getVietnamParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const vietnamDateTimeLocalToIso = (value: string): string => {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) throw new Error('Thời hạn không hợp lệ');
  const date = new Date(`${value}:00${VIETNAM_OFFSET}`);
  if (!Number.isFinite(date.getTime())) throw new Error('Thời hạn không hợp lệ');

  const [, year, month, day, hour, minute] = match;
  if (toVietnamDateTimeLocal(date) !== `${year}-${month}-${day}T${hour}:${minute}`) {
    throw new Error('Thời hạn không hợp lệ');
  }
  return date.toISOString();
};

export const getVietnamDefaultDeadline = (days = 7, now = new Date()): string => {
  const current = getVietnamParts(now);
  const deadline = new Date(Date.UTC(
    current.year,
    current.month - 1,
    current.day + days,
    16,
    59,
    0,
    0,
  ));
  return toVietnamDateTimeLocal(deadline);
};
