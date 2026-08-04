import { describe, expect, it } from 'vitest';
import {
  formatSystemDate,
  formatSystemDateLong,
  formatSystemDateTime,
  formatSystemTime,
  addSystemCalendarDays,
  getSystemDateKey,
  getSystemDateParts,
  getSystemWeekKey,
  systemDateKeyToLabelDate,
  getVietnamDefaultDeadline,
  systemDateTimeLocalToIso,
  toSystemDateTimeLocal,
  toVietnamDateTimeLocal,
  vietnamDateTimeLocalToIso,
} from '../src/utils/dateTime';

describe('Hanoi system time helpers', () => {
  it('formats timestamps in Hanoi even when the instant crosses the UTC date boundary', () => {
    const instant = '2026-08-04T18:00:00.000Z';

    expect(formatSystemDate(instant)).toBe('05/08/2026');
    expect(formatSystemTime(instant)).toBe('01:00');
    expect(formatSystemDateTime(instant)).toBe('05/08/2026 01:00');
    expect(formatSystemDateLong(instant)).toBe('05 tháng 08, 2026');
  });

  it('exposes Hanoi date parts and stable calendar-day arithmetic', () => {
    expect(getSystemDateParts('2026-08-04T18:00:00.000Z')).toEqual({
      year: 2026,
      month: 8,
      day: 5,
      dateKey: '2026-08-05',
    });
    expect(addSystemCalendarDays('2026-08-05', 7)).toBe('2026-08-12');
    expect(addSystemCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(systemDateKeyToLabelDate('2026-08-05').toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });

  it('uses Hanoi calendar days and ISO weeks at the 17:00 UTC boundary', () => {
    expect(getSystemDateKey('2026-08-02T16:59:59.999Z')).toBe('2026-08-02');
    expect(getSystemWeekKey('2026-08-02T16:59:59.999Z')).toBe('2026-W31');
    expect(getSystemDateKey('2026-08-02T17:00:00.000Z')).toBe('2026-08-03');
    expect(getSystemWeekKey('2026-08-02T17:00:00.000Z')).toBe('2026-W32');
  });

  it('round-trips datetime-local values as Hanoi time', () => {
    expect(systemDateTimeLocalToIso('2026-08-05T07:30')).toBe('2026-08-05T00:30:00.000Z');
    expect(toSystemDateTimeLocal('2026-08-05T00:30:00.000Z')).toBe('2026-08-05T07:30');
  });

  it('returns the supplied fallback instead of rendering Invalid Date', () => {
    expect(formatSystemDateTime('not-a-date', 'Không rõ thời gian')).toBe('Không rõ thời gian');
  });

  it('keeps the existing Vietnam assignment aliases working', () => {
    expect(toVietnamDateTimeLocal('2026-07-24T16:59:00.000Z')).toBe('2026-07-24T23:59');
    expect(vietnamDateTimeLocalToIso('2026-07-24T23:59')).toBe('2026-07-24T16:59:00.000Z');
  });

  it('creates the next Hanoi calendar-day deadline at 23:59', () => {
    const now = new Date('2026-07-23T16:30:00.000Z');
    expect(getVietnamDefaultDeadline(1, now)).toBe('2026-07-24T23:59');
  });

  it('rejects malformed local datetime values', () => {
    expect(() => systemDateTimeLocalToIso('not-a-date')).toThrow('Thời hạn không hợp lệ');
  });
});
