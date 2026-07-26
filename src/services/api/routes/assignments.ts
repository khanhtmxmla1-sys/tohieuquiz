import type { RouteRegistry } from '../types';

export const assignmentRoutes: RouteRegistry = {
    get_assignments: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/assignments',
        query: ({ classId }) => {
            const q = new URLSearchParams();
            q.append('classId', classId);
            return q;
        },
    },
    get_teacher_assignments: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/assignments',
        query: ({ teacherUsername }) => {
            const q = new URLSearchParams();
            q.append('teacherUsername', teacherUsername || 'me');
            return q;
        },
    },
    get_all_assignments: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/assignments',
        query: () => new URLSearchParams({ all: 'true' }),
    },
    get_student_assignments: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/assignments',
        query: ({ studentId }) => {
            const q = new URLSearchParams();
            q.append('studentId', studentId);
            return q;
        },
    },
    create_assignment: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/assignments',
    },
    get_smart_assignment_preview: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/assignments/smart-preview',
    },
    delete_assignment: {
        method: 'DELETE',
        auth: 'session',
        path: ({ assignmentId }) => `/api/assignments/${assignmentId}`,
    },
    update_assignment_deadline: {
        method: 'PUT',
        auth: 'session',
        path: ({ assignmentId }) => `/api/assignments/${assignmentId}/deadline`,
    },
    update_assignment_status: {
        method: 'PUT',
        auth: 'session',
        path: ({ assignmentId }) => `/api/assignments/${assignmentId}/status`,
    },
    start_assignment_attempt: {
        method: 'POST',
        auth: 'session',
        path: ({ assignmentId }) => `/api/assignments/${assignmentId}/start`,
    },
};
