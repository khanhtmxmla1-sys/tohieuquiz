import { describe, expect, it } from 'vitest';
import {
  getVietnamDefaultDeadline,
  toVietnamDateTimeLocal,
  vietnamDateTimeLocalToIso,
} from '../src/utils/dateTime';

describe('Vietnam assignment datetime helpers', () => {
  it('formats an ISO deadline for datetime-local without shifting it to UTC', () => {
    expect(toVietnamDateTimeLocal('2026-07-24T16:59:00.000Z')).toBe('2026-07-24T23:59');
  });

  it('converts datetime-local input explicitly from UTC+7 to ISO', () => {
    expect(vietnamDateTimeLocalToIso('2026-07-24T23:59')).toBe('2026-07-24T16:59:00.000Z');
  });

  it('creates the next Vietnam calendar-day deadline at 23:59', () => {
    const now = new Date('2026-07-23T16:30:00.000Z');
    expect(getVietnamDefaultDeadline(1, now)).toBe('2026-07-24T23:59');
  });

  it('rejects malformed local datetime values', () => {
    expect(() => vietnamDateTimeLocalToIso('not-a-date')).toThrow('Thời hạn không hợp lệ');
  });
});
