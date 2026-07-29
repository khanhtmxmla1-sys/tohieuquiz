import type { RouteRegistry } from '../types';

export const systemRoutes: RouteRegistry = {
    get_announcement: {
        method: 'GET',
        auth: 'public',
        path: () => '/api/announcements',
    },
    get_teacher_announcement: {
        method: 'GET', auth: 'session', path: () => '/api/announcements/current',
    },
    get_student_announcement: {
        method: 'GET', auth: 'studentSession', path: () => '/api/announcements/current',
    },
    save_announcement: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/announcements',
    },
    list_announcements: {
        method: 'GET', auth: 'session', path: () => '/api/admin/announcements',
    },
    create_announcement: {
        method: 'POST', auth: 'session', path: () => '/api/admin/announcements',
    },
    update_announcement: {
        method: 'PUT', auth: 'session',
        path: ({ id }) => `/api/admin/announcements/${encodeURIComponent(id)}`,
    },
    publish_announcement: {
        method: 'POST', auth: 'session',
        path: ({ id }) => `/api/admin/announcements/${encodeURIComponent(id)}/publish`,
    },
    cancel_announcement: {
        method: 'POST', auth: 'session',
        path: ({ id }) => `/api/admin/announcements/${encodeURIComponent(id)}/cancel`,
    },
    archive_announcement: {
        method: 'POST', auth: 'session',
        path: ({ id }) => `/api/admin/announcements/${encodeURIComponent(id)}/archive`,
    },
    get_notifications: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/notifications',
        query: ({ filter, cursor, limit }) => {
            const params = new URLSearchParams();
            if (filter) params.set('filter', filter);
            if (cursor) params.set('cursor', cursor);
            if (limit) params.set('limit', String(limit));
            return params;
        },
    },
    get_notification_preferences: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/notifications/preferences',
    },
    save_notification_preferences: {
        method: 'PUT',
        auth: 'session',
        path: () => '/api/notifications/preferences',
    },
    mark_notification_read: {
        method: 'PATCH',
        auth: 'session',
        path: ({ id }) => `/api/notifications/${encodeURIComponent(id)}/read`,
        body: () => ({}),
    },
    record_notification_click: {
        method: 'POST',
        auth: 'session',
        path: ({ id }) => `/api/notifications/${encodeURIComponent(id)}/click`,
        body: () => ({}),
    },
    mark_all_notifications_read: {
        method: 'PATCH',
        auth: 'session',
        path: () => '/api/notifications/read-all',
        body: () => ({}),
    },
    get_notification_metrics: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/admin/notification-metrics',
        query: ({ from, to }) => {
            const params = new URLSearchParams();
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return params;
        },
    },
    get_admin_operations: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/admin/operations',
    },
    get_system_settings: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/system-settings',
    },
    save_system_settings: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/system-settings',
    },
};
