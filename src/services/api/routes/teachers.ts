import type { RouteRegistry } from '../types';

const adminBase = '/api/admin/teachers';

export const teacherRoutes: RouteRegistry = {
    get_teachers: {
        method: 'GET', auth: 'session', path: () => adminBase,
        query: (payload) => new URLSearchParams(Object.entries({
            search: payload.search || '', role: payload.role || '', status: payload.status || '',
            page: String(payload.page || 1), pageSize: String(payload.pageSize || 25),
        }).filter(([, value]) => value !== '')),
    },
    create_teacher: { method: 'POST', auth: 'session', path: () => adminBase },
    update_teacher: {
        method: 'PUT', auth: 'session',
        path: ({ username }) => `${adminBase}/${encodeURIComponent(username)}`,
    },
    reset_teacher_password: {
        method: 'POST', auth: 'session',
        path: ({ username }) => `${adminBase}/${encodeURIComponent(username)}/reset-password`,
    },
    reset_all_teacher_passwords: {
        method: 'POST', auth: 'session',
        path: () => `${adminBase}/reset-passwords`,
        body: () => ({}),
    },
    disable_teacher: {
        method: 'POST', auth: 'session',
        path: ({ username }) => `${adminBase}/${encodeURIComponent(username)}/disable`,
        body: (_action, payload) => ({ transferTo: payload.transferTo, reason: payload.reason }),
    },
    enable_teacher: {
        method: 'POST', auth: 'session',
        path: ({ username }) => `${adminBase}/${encodeURIComponent(username)}/enable`,
        body: () => ({}),
    },
    get_account_profile: { method: 'GET', auth: 'session', path: () => '/api/account/me' },
    change_password: {
        method: 'POST', auth: 'session', path: () => '/api/account/change-password',
        body: (_action, payload) => ({ currentPassword: payload.currentPassword, newPassword: payload.newPassword }),
    },
    logout_all: { method: 'POST', auth: 'session', path: () => '/api/account/logout-all', body: () => ({}) },
    login: { method: 'POST', auth: 'public', path: () => '/api/login' },
    logout: { method: 'POST', auth: 'session', path: () => '/api/logout' },
};
