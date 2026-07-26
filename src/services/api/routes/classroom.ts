import type { RouteRegistry } from '../types';

export const classroomRoutes: RouteRegistry = {
    // Classes
    get_classes: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/classes',
        query: ({ includeArchived }) => {
            const q = new URLSearchParams();
            if (includeArchived) q.set('includeArchived', 'true');
            return q;
        },
    },
    create_class: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/classes',
    },
    transfer_class_teacher: {
        method: 'PATCH',
        auth: 'session',
        path: ({ classId }) => `/api/classes/${encodeURIComponent(classId)}/teacher`,
    },
    delete_class: {
        method: 'PATCH',
        auth: 'session',
        path: ({ classId }) => `/api/classes/${encodeURIComponent(classId)}/archive`,
        body: (_action, payload) => ({ archived: true, ...payload }),
    },
    restore_class: {
        method: 'PATCH',
        auth: 'session',
        path: ({ classId }) => `/api/classes/${encodeURIComponent(classId)}/archive`,
        body: (_action, payload) => ({ archived: false, ...payload }),
    },

    // Students
    get_students: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/students',
        query: ({ classId, role }) => {
            const q = new URLSearchParams();
            q.append('classId', classId);
            if (role) q.append('role', role);
            return q;
        },
    },
    add_student: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/students',
    },
    add_students_batch: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/students/batch',
    },
    delete_student: {
        method: 'DELETE',
        auth: 'session',
        path: ({ studentId }) => `/api/students/${studentId}`,
    },
    reset_student_password: {
        method: 'POST',
        auth: 'session',
        path: ({ studentId }) => `/api/students/${studentId}/reset-password`,
    },
    change_student_password: {
        method: 'POST',
        auth: 'session',
        path: ({ studentId }) => `/api/students/${studentId}/change-password`,
    },
    student_login: {
        method: 'POST',
        auth: 'public',
        path: () => '/api/student-login',
    },
    student_profile: {
        method: 'GET',
        auth: 'studentSession',
        path: () => '/api/student-profile',
    },
    update_student_avatar: {
        method: 'PUT',
        auth: 'session',
        path: ({ studentId }) => `/api/students/${studentId}/avatar`,
    },
};
