import { describe, expect, it } from 'vitest';
import { resolveApiRoute } from '../routeResolver';

const path = (action: string, payload: Record<string, unknown> = {}) => (
  resolveApiRoute(action).path(payload)
);

describe('parent portal API registry', () => {
  it('separates teacher and parent cookie policies', () => {
    expect(resolveApiRoute('create_parent_link')).toMatchObject({ method: 'POST', auth: 'session' });
    expect(resolveApiRoute('get_parent_link')).toMatchObject({ method: 'GET', auth: 'session' });
    expect(resolveApiRoute('parent_login')).toMatchObject({ method: 'POST', auth: 'public' });
    expect(resolveApiRoute('get_parent_dashboard')).toMatchObject({ method: 'GET', auth: 'public' });
    expect(resolveApiRoute('list_parent_notifications')).toMatchObject({ method: 'GET', auth: 'public' });
  });

  it('maps teacher provisioning and announcement routes exactly', () => {
    expect(path('create_parent_link')).toBe('/api/parent-links');
    expect(path('get_parent_link')).toBe('/api/parent-links');
    expect(resolveApiRoute('get_parent_link').query?.({ studentId: 'student 1' }).toString())
      .toBe('studentId=student+1');
    expect(path('reissue_parent_link', { linkId: 'link 1' })).toBe('/api/parent-links/link%201/reissue');
    expect(path('revoke_parent_link', { linkId: 'link 1' })).toBe('/api/parent-links/link%201');
    expect(path('create_parent_announcement')).toBe('/api/parent-announcements');
    expect(path('revoke_parent_announcement', { announcementId: 'a 1' }))
      .toBe('/api/parent-announcements/a%201/revoke');
    expect(path('get_parent_delivery')).toBe('/api/parent-delivery');
  });

  it('maps activation, login, dashboard, feed and histories', () => {
    expect(path('get_parent_activation')).toBe('/api/parent/activation');
    expect(resolveApiRoute('get_parent_activation').query?.({ token: 'a+b' }).toString()).toBe('token=a%2Bb');
    expect(path('activate_parent_link')).toBe('/api/parent/activate');
    expect(path('parent_login')).toBe('/api/parent/login');
    expect(path('get_parent_session')).toBe('/api/parent/session');
    expect(path('parent_logout')).toBe('/api/parent/logout');
    expect(path('get_parent_dashboard')).toBe('/api/parent/dashboard');
    expect(path('mark_parent_notification_read', { notificationId: 'n 1' }))
      .toBe('/api/parent/notifications/n%201/read');
    expect(path('mark_all_parent_notifications_read')).toBe('/api/parent/notifications/read-all');
    expect(path('get_parent_result', { resultId: 'r 1' })).toBe('/api/parent/results/r%201');
    expect(path('list_parent_assignments')).toBe('/api/parent/assignments');
    expect(path('list_parent_certificates')).toBe('/api/parent/certificates');
  });
});
