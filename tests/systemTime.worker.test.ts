import { describe, expect, it } from 'vitest';
import {
  formatSystemDate,
  formatSystemDateTime,
  getSystemDateKey,
  getSystemDateTimeParts,
  getSystemDayUtcRange,
  getSystemDeadlineIso,
  getSystemWeekKey,
  getSystemWeekUtcRange,
} from '../workers/src/utils/systemTime';
import {
  SYSTEM_LOCALE,
  SYSTEM_TIME_ZONE,
  SYSTEM_UTC_OFFSET,
} from '../shared/time-zone.contract';

describe('Worker Hanoi system time helpers', () => {
  it('exports one shared system time contract', () => {
    expect(SYSTEM_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    expect(SYSTEM_LOCALE).toBe('vi-VN');
    expect(SYSTEM_UTC_OFFSET).toBe('+07:00');
  });

  it('formats notifications in Hanoi time', () => {
    const instant = new Date('2026-08-04T18:00:00.000Z');
    expect(formatSystemDate(instant)).toBe('05/08/2026');
    expect(formatSystemDateTime(instant)).toBe('05/08/2026 01:00');
  });

  it('exposes Hanoi clock parts and UTC bounds without runtime timezone math', () => {
    expect(getSystemDateTimeParts(new Date('2026-08-04T18:30:00.000Z'))).toMatchObject({
      dateKey: '2026-08-05',
      hour: 1,
      minute: 30,
      weekday: 3,
    });
    expect(getSystemDayUtcRange(new Date('2026-08-04T18:30:00.000Z'))).toEqual({
      start: '2026-08-04T17:00:00.000Z',
      end: '2026-08-05T17:00:00.000Z',
    });
  });

  it('creates Hanoi end-of-day deadlines and ISO week UTC ranges', () => {
    expect(getSystemDeadlineIso(1, new Date('2026-08-04T16:30:00.000Z')))
      .toBe('2026-08-05T16:59:00.000Z');
    expect(getSystemWeekUtcRange('2026-W32')).toEqual({
      startDateKey: '2026-08-03',
      endDateKey: '2026-08-09',
      startIso: '2026-08-02T17:00:00.000Z',
      endIsoExclusive: '2026-08-09T17:00:00.000Z',
    });
  });

  it('computes business date and ISO week from the Hanoi calendar', () => {
    expect(getSystemDateKey(new Date('2026-08-02T16:59:59.999Z'))).toBe('2026-08-02');
    expect(getSystemWeekKey(new Date('2026-08-02T16:59:59.999Z'))).toBe('2026-W31');
    expect(getSystemDateKey(new Date('2026-08-02T17:00:00.000Z'))).toBe('2026-08-03');
    expect(getSystemWeekKey(new Date('2026-08-02T17:00:00.000Z'))).toBe('2026-W32');
  });
});
