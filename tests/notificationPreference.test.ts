import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationDedupeKey,
  normalizeNotificationPreferences,
  resolveNotificationDelivery,
  severityFromPriority,
} from '../workers/src/services/notificationPolicy';

describe('notification preference policy', () => {
  it('maps legacy priorities to the canonical severity classes', () => {
    expect(severityFromPriority('URGENT')).toBe('critical');
    expect(severityFromPriority('IMPORTANT')).toBe('action_required');
    expect(severityFromPriority('REMINDER')).toBe('action_required');
    expect(severityFromPriority('INFO')).toBe('informational');
  });

  it('never disables critical delivery and only delays informational quiet-hour messages', () => {
    const preferences = normalizeNotificationPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      actionRequiredEnabled: false,
      informationalEnabled: true,
      quietHoursEnabled: true,
      quietStart: '21:00',
      quietEnd: '06:30',
      timezoneOffsetMinutes: 420,
      typePreferences: { system: false },
    });

    expect(resolveNotificationDelivery({
      severity: 'critical', type: 'system', createdAt: '2026-07-28T16:00:00.000Z', preferences,
    })).toMatchObject({ deliver: true, delayed: false, reason: 'immediate' });
    expect(resolveNotificationDelivery({
      severity: 'action_required', type: 'assignment_created', createdAt: '2026-07-28T16:00:00.000Z', preferences,
    })).toMatchObject({ deliver: false, reason: 'severity-disabled' });
    expect(resolveNotificationDelivery({
      severity: 'informational', type: 'gift_delivered', createdAt: '2026-07-28T16:00:00.000Z', preferences,
    })).toMatchObject({ deliver: true, delayed: true, reason: 'quiet-hours' });
  });

  it('builds a stable dedupe key per recipient resource window', () => {
    const first = notificationDedupeKey({
      type: 'assignment_created', sourceType: 'assignment', sourceId: 'a-1',
      createdAt: '2026-07-28T10:10:00.000Z', windowMinutes: 60,
    });
    const sameWindow = notificationDedupeKey({
      type: 'assignment_created', sourceType: 'assignment', sourceId: 'a-1',
      createdAt: '2026-07-28T10:55:00.000Z', windowMinutes: 60,
    });
    const laterWindow = notificationDedupeKey({
      type: 'assignment_created', sourceType: 'assignment', sourceId: 'a-1',
      createdAt: '2026-07-28T11:05:00.000Z', windowMinutes: 60,
    });
    expect(first).toBe(sameWindow);
    expect(laterWindow).not.toBe(first);
  });
});
