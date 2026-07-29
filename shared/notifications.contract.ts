export const NOTIFICATION_PRIORITIES = [
  'INFO',
  'REMINDER',
  'IMPORTANT',
  'URGENT',
] as const;

export const NOTIFICATION_SEVERITIES = [
  'critical',
  'action_required',
  'informational',
] as const;

export const ANNOUNCEMENT_CHANNELS = [
  'CRITICAL_STRIP',
  'TICKER',
  'BANNER',
  'INBOX',
] as const;

export const NOTIFICATION_TYPES = [
  'assignment_created',
  'assignment_due_soon',
  'assignment_submitted',
  'homework_graded',
  'live_exam_ready',
  'result_report_ready',
  'result_report_published',
  'certificate_issued',
  'certificate_batch_completed',
  'delivery_failed',
  'gift_delivered',
  'system',
] as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number];
export type NotificationSeverity = typeof NOTIFICATION_SEVERITIES[number];
export type AnnouncementChannel = typeof ANNOUNCEMENT_CHANNELS[number];
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export interface NotificationPreferences {
  criticalEnabled: true;
  actionRequiredEnabled: boolean;
  informationalEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezoneOffsetMinutes: number;
  typePreferences: Partial<Record<NotificationType, boolean>>;
}

export interface NotificationMetricBucket {
  severity: NotificationSeverity;
  sent: number;
  read: number;
  clicked: number;
}

export type NotificationTarget =
  | { kind: 'assignment'; assignmentId: string }
  | { kind: 'result-report'; reportId: string }
  | { kind: 'certificate'; certificateId: string }
  | { kind: 'live-exam'; examId: string }
  | { kind: 'url'; url: string };

export interface InboxNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  actionUrl: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  availableAt: string;
  expiresAt: string | null;
}

export interface NotificationTargetInput {
  type: NotificationType;
  data: Record<string, unknown>;
  actionUrl: string | null;
}

export function isNotificationPriority(value: unknown): value is NotificationPriority {
  return typeof value === 'string'
    && NOTIFICATION_PRIORITIES.includes(value as NotificationPriority);
}

export function isNotificationSeverity(value: unknown): value is NotificationSeverity {
  return typeof value === 'string'
    && NOTIFICATION_SEVERITIES.includes(value as NotificationSeverity);
}

export function isAnnouncementChannel(value: unknown): value is AnnouncementChannel {
  return typeof value === 'string'
    && ANNOUNCEMENT_CHANNELS.includes(value as AnnouncementChannel);
}

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string'
    && NOTIFICATION_TYPES.includes(value as NotificationType);
}

export function isSafeNotificationActionUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/u.test(value)) return false;
  const pathname = value.split(/[?#]/u, 1)[0];
  const allowed = [
    '/', '/student', '/teacher', '/admin', '/dashboard', '/results', '/assignments',
    '/certificates', '/gift-shop', '/live-exam', '/help', '/thu-vien', '/parent',
    '/profile', '/notifications', '/homework', '/phieu', '/quizzes',
  ];
  return allowed.some((prefix) => pathname === prefix
    || (prefix !== '/' && pathname.startsWith(`${prefix}/`)));
}

function payloadId(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function resolveNotificationTarget(
  input: NotificationTargetInput,
): NotificationTarget | null {
  if (input.type === 'assignment_created'
    || input.type === 'assignment_due_soon'
    || input.type === 'assignment_submitted'
    || input.type === 'homework_graded') {
    const assignmentId = payloadId(input.data, 'assignment_id');
    return assignmentId ? { kind: 'assignment', assignmentId } : null;
  }

  if (input.type === 'result_report_ready') {
    const reportId = payloadId(input.data, 'report_id');
    return reportId ? { kind: 'result-report', reportId } : null;
  }

  if (input.type === 'result_report_published') {
    const reportId = payloadId(input.data, 'phieu_id');
    return reportId ? { kind: 'result-report', reportId } : null;
  }

  if (input.type === 'certificate_issued') {
    const certificateId = payloadId(input.data, 'certificate_id');
    return certificateId ? { kind: 'certificate', certificateId } : null;
  }

  if (input.type === 'live_exam_ready') {
    const examId = payloadId(input.data, 'exam_id');
    return examId ? { kind: 'live-exam', examId } : null;
  }

  return isSafeNotificationActionUrl(input.actionUrl)
    ? { kind: 'url', url: input.actionUrl }
    : null;
}
