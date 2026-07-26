import type { RouteRegistry } from '../types';

export const aiRoutes: RouteRegistry = {
    ai_tutor_diagnose: {
        method: 'POST',
        auth: 'session', // AI features require login
        path: () => '/api/ai-tutor/diagnose',
    },
    ai_chat: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/ai/chat',
    },
    get_teacher_ai_quota: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/teacher-ai-quota',
    },
    consume_teacher_ai_quota: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/teacher-ai-quota/consume',
    },
    ask_help_rag: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/help/ask',
    },
};
