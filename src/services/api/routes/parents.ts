import type { ApiPayload, RouteRegistry } from '../types';

const encode = (value: unknown) => encodeURIComponent(String(value || ''));
const strip = (...fields: string[]) => (_action: string, payload: ApiPayload) => {
  const body = { ...payload };
  for (const field of fields) delete body[field];
  return body;
};

const historyQuery = (payload: ApiPayload) => {
  const query = new URLSearchParams();
  for (const field of ['page', 'limit', 'subject', 'from', 'to'] as const) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      query.set(field, String(payload[field]));
    }
  }
  return query;
};

// Parent-authenticated routes intentionally use `public`: the independent
// parent_auth_token cookie is validated inside the Parent Portal Worker router.
export const parentRoutes: RouteRegistry = {
  create_parent_link: {
    method: 'POST', auth: 'session', path: () => '/api/parent-links',
  },
  get_parent_link: {
    method: 'GET', auth: 'session', path: () => '/api/parent-links',
    query: payload => new URLSearchParams({ studentId: String(payload.studentId || '') }),
  },
  reissue_parent_link: {
    method: 'POST', auth: 'session',
    path: payload => `/api/parent-links/${encode(payload.linkId)}/reissue`,
    body: strip('linkId'),
  },
  revoke_parent_link: {
    method: 'DELETE', auth: 'session',
    path: payload => `/api/parent-links/${encode(payload.linkId)}`,
  },
  create_parent_announcement: {
    method: 'POST', auth: 'session', path: () => '/api/parent-announcements',
  },
  list_parent_announcements: {
    method: 'GET', auth: 'session', path: () => '/api/parent-announcements',
    query: payload => new URLSearchParams({ classId: String(payload.classId || '') }),
  },
  revoke_parent_announcement: {
    method: 'POST', auth: 'session',
    path: payload => `/api/parent-announcements/${encode(payload.announcementId)}/revoke`,
    body: strip('announcementId'),
  },
  get_parent_delivery: {
    method: 'GET', auth: 'session', path: () => '/api/parent-delivery',
    query: payload => {
      const query = new URLSearchParams({ classId: String(payload.classId || '') });
      if (payload.kind) query.set('kind', String(payload.kind));
      return query;
    },
  },
  get_parent_activation: {
    method: 'GET', auth: 'public', path: () => '/api/parent/activation',
    query: payload => new URLSearchParams({ token: String(payload.token || '') }),
  },
  activate_parent_link: {
    method: 'POST', auth: 'public', path: () => '/api/parent/activate',
  },
  parent_login: {
    method: 'POST', auth: 'public', path: () => '/api/parent/login',
  },
  get_parent_session: {
    method: 'GET', auth: 'public', path: () => '/api/parent/session',
  },
  parent_logout: {
    method: 'POST', auth: 'public', path: () => '/api/parent/logout', body: () => ({}),
  },
  get_parent_preferences: {
    method: 'GET', auth: 'public', path: () => '/api/parent/preferences',
  },
  update_parent_preferences: {
    method: 'PUT', auth: 'public', path: () => '/api/parent/preferences',
  },
  request_parent_email_verification: {
    method: 'POST', auth: 'public', path: () => '/api/parent/preferences/email/request-verification',
    body: () => ({}),
  },
  verify_parent_email: {
    method: 'POST', auth: 'public', path: () => '/api/parent/preferences/email/verify',
  },
  request_parent_pin_recovery: {
    method: 'POST', auth: 'public', path: () => '/api/parent/recovery/request',
  },
  confirm_parent_pin_recovery: {
    method: 'POST', auth: 'public', path: () => '/api/parent/recovery/confirm',
  },
  get_parent_dashboard: {
    method: 'GET', auth: 'public', path: () => '/api/parent/dashboard',
    query: payload => {
      const query = new URLSearchParams();
      if (payload.weekStart) query.set('weekStart', String(payload.weekStart));
      return query;
    },
  },
  list_parent_notifications: {
    method: 'GET', auth: 'public', path: () => '/api/parent/notifications',
    query: payload => {
      const query = new URLSearchParams();
      for (const field of ['kind', 'cursor', 'limit'] as const) {
        if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
          query.set(field, String(payload[field]));
        }
      }
      if (payload.unread === true) query.set('unread', 'true');
      return query;
    },
  },
  mark_parent_notification_read: {
    method: 'PATCH', auth: 'public',
    path: payload => `/api/parent/notifications/${encode(payload.notificationId)}/read`,
    body: strip('notificationId'),
  },
  mark_all_parent_notifications_read: {
    method: 'POST', auth: 'public', path: () => '/api/parent/notifications/read-all',
    body: () => ({}),
  },
  list_parent_results: {
    method: 'GET', auth: 'public', path: () => '/api/parent/results', query: historyQuery,
  },
  get_parent_result: {
    method: 'GET', auth: 'public',
    path: payload => `/api/parent/results/${encode(payload.resultId)}`,
  },
  list_parent_assignments: {
    method: 'GET', auth: 'public', path: () => '/api/parent/assignments', query: historyQuery,
  },
  list_parent_certificates: {
    method: 'GET', auth: 'public', path: () => '/api/parent/certificates', query: historyQuery,
  },
};
