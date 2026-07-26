import type { ApiPayload, RouteRegistry } from '../types';

const assignmentPath = (payload: ApiPayload) => `/api/homework/assignments/${encodeURIComponent(payload.assignmentId || payload.id)}`;
const submissionPath = (payload: ApiPayload) => `/api/homework/submissions/${encodeURIComponent(payload.submissionId || payload.id)}`;

export const homeworkRoutes: RouteRegistry = {
    homework_list_teacher_assignments: {
        method: 'GET', auth: 'session', path: () => '/api/homework/assignments',
        query: (payload) => new URLSearchParams(payload.classId ? { classId: payload.classId } : {}),
    },
    homework_list_student_assignments: {
        method: 'GET', auth: 'studentSession', path: () => '/api/homework/assignments',
    },
    homework_create_assignment: {
        method: 'POST', auth: 'session', path: () => '/api/homework/assignments', body: (_action, payload) => payload,
    },
    homework_update_assignment: {
        method: 'PATCH', auth: 'session', path: assignmentPath, body: (_action, payload) => payload,
    },
    homework_archive_assignment: {
        method: 'POST', auth: 'session', path: (payload) => `${assignmentPath(payload)}/archive`, body: () => ({}),
    },
    homework_list_submissions: {
        method: 'GET', auth: 'session', path: (payload) => `${assignmentPath(payload)}/submissions`,
    },
    homework_list_my_submissions: {
        method: 'GET', auth: 'studentSession', path: (payload) => `${assignmentPath(payload)}/submissions`,
    },
    homework_list_all_my_submissions: {
        method: 'GET', auth: 'studentSession', path: () => '/api/homework/submissions/mine',
    },
    homework_submit: {
        method: 'POST', auth: 'studentSession', path: (payload) => `${assignmentPath(payload)}/submissions`, body: (_action, payload) => payload,
    },
    homework_ocr: {
        method: 'POST', auth: 'session', path: () => '/api/homework/ocr', body: (_action, payload) => payload,
    },
    homework_ai_suggestion: {
        method: 'POST', auth: 'session', path: (payload) => `${submissionPath(payload)}/ai-suggestion`, body: () => ({}),
    },
    homework_publish_grade: {
        method: 'PATCH', auth: 'session', path: (payload) => `${submissionPath(payload)}/grade`, body: (_action, payload) => payload,
    },
    homework_assignment_analytics: {
        method: 'GET', auth: 'session', path: (payload) => `${assignmentPath(payload)}/analytics`,
    },
};
