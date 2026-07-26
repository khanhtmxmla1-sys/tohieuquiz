import { describe, expect, it } from 'vitest';
import {
  ANNOUNCEMENT_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  isAnnouncementChannel,
  isNotificationPriority,
  isNotificationType,
  resolveNotificationTarget,
} from '../shared/notifications.contract';

describe('unified notification contract', () => {
  it('accepts only supported priority, channel, and type values', () => {
    expect(NOTIFICATION_PRIORITIES).toEqual([
      'INFO',
      'REMINDER',
      'IMPORTANT',
      'URGENT',
    ]);
    expect(ANNOUNCEMENT_CHANNELS).toEqual([
      'CRITICAL_STRIP',
      'TICKER',
      'BANNER',
      'INBOX',
    ]);
    expect(NOTIFICATION_TYPES).toContain('assignment_created');
    expect(NOTIFICATION_TYPES).toContain('certificate_issued');
    expect(NOTIFICATION_TYPES).toContain('result_report_published');

    expect(isNotificationPriority('URGENT')).toBe(true);
    expect(isNotificationPriority('critical')).toBe(false);
    expect(isAnnouncementChannel('TICKER')).toBe(true);
    expect(isAnnouncementChannel('toast')).toBe(false);
    expect(isNotificationType('result_report_ready')).toBe(true);
    expect(isNotificationType('unknown')).toBe(false);
  });

  it('maps typed payloads to safe application targets', () => {
    expect(resolveNotificationTarget({
      type: 'assignment_created',
      data: { assignment_id: 'assignment-1' },
      actionUrl: null,
    })).toEqual({ kind: 'assignment', assignmentId: 'assignment-1' });

    expect(resolveNotificationTarget({
      type: 'certificate_issued',
      data: { certificate_id: 'certificate-1' },
      actionUrl: null,
    })).toEqual({ kind: 'certificate', certificateId: 'certificate-1' });

    expect(resolveNotificationTarget({
      type: 'result_report_published',
      data: { phieu_id: 'phieu-1' },
      actionUrl: null,
    })).toEqual({ kind: 'result-report', reportId: 'phieu-1' });

    expect(resolveNotificationTarget({
      type: 'system',
      data: {},
      actionUrl: '/thu-vien',
    })).toEqual({ kind: 'url', url: '/thu-vien' });
  });

  it('rejects malformed identifiers and unsafe URL targets', () => {
    expect(resolveNotificationTarget({
      type: 'assignment_created',
      data: { assignment_id: '' },
      actionUrl: null,
    })).toBeNull();

    expect(resolveNotificationTarget({
      type: 'system',
      data: {},
      actionUrl: 'javascript:alert(1)',
    })).toBeNull();

    expect(resolveNotificationTarget({
      type: 'system',
      data: {},
      actionUrl: '//evil.example/path',
    })).toBeNull();
  });
});
