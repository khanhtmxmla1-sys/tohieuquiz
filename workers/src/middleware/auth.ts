// Central route policy gate.
// Public routes and routes with explicit JWT checks are allowed to reach their handlers.
// Any unclassified route fails closed; shared API tokens are no longer supported.

import { errorResponse } from '../utils/response';
import { Env } from '../types';

export function verifyToken(request: Request, _env: Env): Response | null {
    const { pathname: path } = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return null;
    if (path === '/api/health') return null;
    if ((path === '/api/announcements' || path === '/api/announcements/current') && method === 'GET') return null;
    if (path === '/api/system-settings' && method === 'GET') return null;
    if (path === '/api/login' || path === '/api/student-login') return null;
    if (path.startsWith('/api/practice')) return null;

    const routeHandlerOwnsAuthentication = [
        '/api/logout',
        '/api/teachers',
        '/api/admin/teachers',
        '/api/account',
        '/api/admin/announcements',
        '/api/announcements',
        '/api/classes',
        '/api/students',
        '/api/student-profile',
        '/api/assignments',
        '/api/results',
        '/api/result-reports',
        '/api/parent',
        '/api/parent-links',
        '/api/parent-announcements',
        '/api/parent-delivery',
        '/api/validate',
        '/api/quizzes',
        '/api/quiz-drafts',
        '/api/questions',
        '/api/game-loop',
        '/api/game-state',
        '/api/pets',
        '/api/shop',
        '/api/leaderboard',
        '/api/gift-shop',
        '/api/live-exam',
        '/api/admin/certificate-templates',
        '/api/certificate-batches',
        '/api/certificates',
        '/api/notifications',
        '/api/homework',
        '/api/analytics',
        '/api/phieu',
        '/api/math/telemetry',
        '/api/admin/math-audit',
        '/api/admin/math-telemetry',
        '/api/system-settings',
        '/api/ai-tutor',
        '/api/ai',
        '/api/help',
        '/api/teacher-ai-quota',
        '/api/test-bank',
    ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

    if (routeHandlerOwnsAuthentication) return null;
    return errorResponse('Unauthorized: route has no explicit authentication policy', 401);
}
