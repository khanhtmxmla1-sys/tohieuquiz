import {
  NOTIFICATION_TYPES,
  type NotificationPreferences,
  type NotificationSeverity,
  type NotificationType,
} from '../../../shared/notifications.contract';
import { SYSTEM_UTC_OFFSET_MINUTES } from '../../../shared/time-zone.contract';

const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  criticalEnabled: true,
  actionRequiredEnabled: true,
  informationalEnabled: true,
  quietHoursEnabled: false,
  quietStart: '21:00',
  quietEnd: '06:30',
  timezoneOffsetMinutes: SYSTEM_UTC_OFFSET_MINUTES,
  typePreferences: {},
};

export interface NotificationDeliveryDecision {
  deliver: boolean;
  availableAt: string;
  delayed: boolean;
  reason: 'immediate' | 'quiet-hours' | 'severity-disabled' | 'type-disabled';
}

export function severityFromPriority(priority: string): NotificationSeverity {
  if (priority === 'URGENT') return 'critical';
  if (priority === 'IMPORTANT' || priority === 'REMINDER') return 'action_required';
  return 'informational';
}

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function normalizeNotificationPreferences(
  input: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  const start = parseClock(String(input?.quietStart ?? ''));
  const end = parseClock(String(input?.quietEnd ?? ''));
  const offset = Number(input?.timezoneOffsetMinutes);
  const typePreferences = Object.fromEntries(
    Object.entries(input?.typePreferences ?? {})
      .filter(([type, enabled]) => NOTIFICATION_TYPES.includes(type as NotificationType)
        && typeof enabled === 'boolean'),
  ) as Partial<Record<NotificationType, boolean>>;

  return {
    criticalEnabled: true,
    actionRequiredEnabled: input?.actionRequiredEnabled !== false,
    informationalEnabled: input?.informationalEnabled !== false,
    quietHoursEnabled: input?.quietHoursEnabled === true,
    quietStart: start === null ? DEFAULT_NOTIFICATION_PREFERENCES.quietStart : String(input?.quietStart),
    quietEnd: end === null ? DEFAULT_NOTIFICATION_PREFERENCES.quietEnd : String(input?.quietEnd),
    timezoneOffsetMinutes: Number.isInteger(offset) && offset >= -720 && offset <= 840
      ? offset
      : DEFAULT_NOTIFICATION_PREFERENCES.timezoneOffsetMinutes,
    typePreferences,
  };
}

function nextQuietEnd(
  createdAt: Date,
  quietStartMinutes: number,
  quietEndMinutes: number,
  timezoneOffsetMinutes: number,
): Date {
  const localNow = new Date(createdAt.getTime() + timezoneOffsetMinutes * 60_000);
  const localMinute = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
  const overnight = quietStartMinutes > quietEndMinutes;
  const inQuietHours = overnight
    ? localMinute >= quietStartMinutes || localMinute < quietEndMinutes
    : localMinute >= quietStartMinutes && localMinute < quietEndMinutes;
  if (!inQuietHours) return createdAt;

  const localEnd = new Date(localNow);
  localEnd.setUTCHours(Math.floor(quietEndMinutes / 60), quietEndMinutes % 60, 0, 0);
  if ((overnight && localMinute >= quietStartMinutes) || (!overnight && localMinute >= quietEndMinutes)) {
    localEnd.setUTCDate(localEnd.getUTCDate() + 1);
  }
  return new Date(localEnd.getTime() - timezoneOffsetMinutes * 60_000);
}

export function resolveNotificationDelivery(input: {
  severity: NotificationSeverity;
  type: NotificationType;
  createdAt: string;
  preferences: NotificationPreferences;
}): NotificationDeliveryDecision {
  const createdAt = new Date(input.createdAt);
  const preferences = normalizeNotificationPreferences(input.preferences);
  if (input.severity !== 'critical' && preferences.typePreferences[input.type] === false) {
    return { deliver: false, availableAt: input.createdAt, delayed: false, reason: 'type-disabled' };
  }
  if (input.severity === 'action_required' && !preferences.actionRequiredEnabled) {
    return { deliver: false, availableAt: input.createdAt, delayed: false, reason: 'severity-disabled' };
  }
  if (input.severity === 'informational' && !preferences.informationalEnabled) {
    return { deliver: false, availableAt: input.createdAt, delayed: false, reason: 'severity-disabled' };
  }
  if (input.severity !== 'informational' || !preferences.quietHoursEnabled) {
    return { deliver: true, availableAt: input.createdAt, delayed: false, reason: 'immediate' };
  }

  const quietStart = parseClock(preferences.quietStart) ?? 21 * 60;
  const quietEnd = parseClock(preferences.quietEnd) ?? 6 * 60 + 30;
  const availableAt = nextQuietEnd(
    createdAt,
    quietStart,
    quietEnd,
    preferences.timezoneOffsetMinutes,
  ).toISOString();
  const delayed = availableAt !== createdAt.toISOString();
  return {
    deliver: true,
    availableAt,
    delayed,
    reason: delayed ? 'quiet-hours' : 'immediate',
  };
}

export function notificationDedupeKey(input: {
  type: NotificationType;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  windowMinutes?: number;
}): string | null {
  if (!input.sourceType || !input.sourceId) return null;
  const windowMinutes = Math.min(7 * MINUTES_PER_DAY, Math.max(1, input.windowMinutes ?? 60));
  const window = Math.floor(new Date(input.createdAt).getTime() / (windowMinutes * 60_000));
  return [input.type, input.sourceType, input.sourceId, window].join(':');
}
