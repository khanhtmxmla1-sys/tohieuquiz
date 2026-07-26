// TôHiệuQuiz Workers API - Main Entry Point
// Cloudflare Workers API entry point

import { handleCors, corsHeaders } from './middleware/cors';
import { enforceOriginGuard } from './middleware/originGuard';
import { verifyToken } from './middleware/auth';
import { jsonResponse, errorResponse } from './utils/response';
import { internalErrorResponse } from './utils/internalError';
import { handleTeacherRoutes } from './routes/teachers';
import { handleQuizRoutes } from './routes/quizzes';
import { handleQuizDraftRoutes } from './routes/quizDrafts';
import { handleResultRoutes } from './routes/results';
import { handleClassroomRoutes } from './routes/classroom';
import { handleGamificationRoutes } from './routes/gamification';
import { handleAnnouncementRoutes } from './routes/announcements';
import { handleAiTutorRoutes } from './routes/aiTutor';
import { handleAiProxy } from './routes/aiProxy';
import { handlePracticeRoutes } from './routes/practice';
import { handleGiftShopRoutes } from './routes/giftShop';
import { handleGameLoopRoutes } from './routes/gameLoop';
import { handleHelpRagRoutes } from './routes/helpRag';
import { handleSystemSettingsRoutes } from './routes/systemSettings';
import { handleAnalyticsRoutes } from './routes/analytics';
import { handleMathObservabilityRoutes } from './routes/mathObservability';
import { handleHomeworkRoutes } from './routes/homework';
import {
  createBatch,
  getBatches,
  getBatchDetail,
  preview,
  uploadTemplate,
  getTemplates,
  getMyCertificates
} from './routes/certificates';
import { handleTestBankRoutes } from './routes/testBank';
import { handleTeacherAiQuotaRoutes } from './routes/teacherAiQuota';
import { handleLogoutRoute } from './routes/logout';
import { handleLiveExamRoutes } from './routes/liveExam';
import { handleAdminCertificateRoutes } from './routes/adminCertificates';
import { handleCertificateRoutes } from './routes/certificates';
import { handlePhieuSubdomain, handlePublicPhieuApi, handlePhieuRoutes } from './routes/phieu';
import { handleResultReportRoutes } from './routes/resultReports';
import { handleParentPortalRoutes } from './routes/parentPortal';
import { handleNotificationRoutes } from './routes/notifications/route';
import { Env } from './types';
import { rateLimit } from './middleware/rateLimit';
import { mapQuestionForSave, mapAssignment, mapAssignments, handleValidateAnswers } from './utils/helpers';
import { checkAndAutoCloseExpiredExams } from './services/liveExamService';
import { createDueHomeworkReminders } from './parentPortal/deadlineReminderService';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Handle CORS preflight before every route, including health.
        const corsResponse = handleCors(request, env);
        if (corsResponse) return corsResponse;

        if (path === '/api/health') {
            return addCors(jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }), request, env);
        }

        const originError = enforceOriginGuard(request, env);
        if (originError) return addCors(originError, request, env);

        const isUnsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const isLoginAttempt = method === 'POST' && (path === '/api/login' || path === '/api/student-login');
        if (isLoginAttempt) {
            const rateLimitRes = await rateLimit(request, env, {
                windowMs: 60 * 1000,
                maxRequests: 20,
                failureMode: 'closed',
            });
            if (rateLimitRes) return addCors(rateLimitRes, request, env);
        }

        const isParentLoginAttempt = method === 'POST'
            && (path === '/api/parent/activate' || path === '/api/parent/login');
        if (isParentLoginAttempt) {
            const rateLimitRes = await rateLimit(request, env, {
                windowMs: 5 * 60 * 1000,
                maxRequests: 10,
                failureMode: 'closed',
            });
            if (rateLimitRes) return addCors(rateLimitRes, request, env);
        }

        const isAdminMutation = isUnsafeMethod && (
            path.startsWith('/api/admin/')
            || path === '/api/teachers'
            || path.startsWith('/api/teachers/')
            || path === '/api/system-settings'
            || path === '/api/announcements'
            || path.startsWith('/api/classes')
            || path.startsWith('/api/gift-shop/catalog')
        );
        if (isAdminMutation) {
            const rateLimitRes = await rateLimit(request, env, {
                windowMs: 60 * 1000,
                maxRequests: 30,
                failureMode: 'closed',
            });
            if (rateLimitRes) return addCors(rateLimitRes, request, env);
        }

        // Math observability is self-contained and must not be shadowed by legacy/public handlers.
        // Dispatch it before the phieu subdomain and shared-token middleware.
        if (
            path.startsWith('/api/math/telemetry') ||
            path.startsWith('/api/admin/math-audit') ||
            path.startsWith('/api/admin/math-telemetry')
        ) {
            if (path === '/api/math/telemetry' && method === 'POST') {
                const rateLimitRes = await rateLimit(request, env, { windowMs: 60 * 1000, maxRequests: 30 });
                if (rateLimitRes) return addCors(rateLimitRes, request, env);
            }

            const mathResponse = await handleMathObservabilityRoutes(request, env, path, method);
            if (mathResponse) return addCors(mathResponse, request, env);
        }

        const phieuSubdomainResponse = await handlePhieuSubdomain(request, env);
        if (phieuSubdomainResponse) return addCors(phieuSubdomainResponse, request, env);

        // Rate limit for public phieu
        if (path.startsWith('/api/phieu/public')) {
            const rateLimitRes = await rateLimit(request, env, { windowMs: 60 * 1000, maxRequests: 30 });
            if (rateLimitRes) return addCors(rateLimitRes, request, env);
        }

        const publicPhieuResponse = await handlePublicPhieuApi(env.DB, path, method);
        if (publicPhieuResponse) return addCors(publicPhieuResponse, request, env);

        const isParentRoute = path.startsWith('/api/parent/')
            || path.startsWith('/api/parent-links')
            || path.startsWith('/api/parent-announcements')
            || path.startsWith('/api/parent-delivery');
        if (isParentRoute) {
            const parentResponse = await handleParentPortalRoutes(request, env, path, method);
            return addCors(parentResponse, request, env);
        }

        // Auth check from header
        const authError = verifyToken(request, env);
        if (authError) return addCors(authError, request, env);

        try {
            // ============ RESTful API ROUTES ============
            let response: Response | null = null;

            if (path.startsWith('/api/teachers') || path.startsWith('/api/admin/teachers') || path.startsWith('/api/account') || path === '/api/login') {
                response = await handleTeacherRoutes(request, env, path, method);
            } else if (path === '/api/logout' && method === 'POST') {
                response = await handleLogoutRoute(request, env);
            } else if (path.startsWith('/api/quiz-drafts/')) {
                response = await handleQuizDraftRoutes(request, env, path, method);
            } else if (path.startsWith('/api/quizzes') || path.startsWith('/api/questions')) {
                response = await handleQuizRoutes(request, env, path, method);
            } else if (path.startsWith('/api/results') || path === '/api/validate') {
                response = await handleResultRoutes(request, env, path, method);
            } else if (path.startsWith('/api/classes') || path.startsWith('/api/students') || path.startsWith('/api/assignments') || path === '/api/student-login' || path === '/api/student-profile') {
                response = await handleClassroomRoutes(request, env, path, method);
            } else if (path.startsWith('/api/pets') || path.startsWith('/api/game-state') || path.startsWith('/api/shop') || path.startsWith('/api/leaderboard')) {
                response = await handleGamificationRoutes(request, env, path, method);
            } else if (path.startsWith('/api/announcements') || path.startsWith('/api/admin/announcements')) {
                response = await handleAnnouncementRoutes(request, env, path, method);
            } else if (path.startsWith('/api/ai-tutor')) {
                const rateLimitRes = await rateLimit(request, env, { windowMs: 60 * 1000, maxRequests: 10, failureMode: 'closed' });
                if (rateLimitRes) return addCors(rateLimitRes, request, env);
                response = await handleAiTutorRoutes(request, env, path, method);
            } else if (path.startsWith('/api/ai/')) {
                response = await handleAiProxy(request, env, path, method);
            } else if (path.startsWith('/api/practice')) {
                response = await handlePracticeRoutes(request, env, path, method);
            } else if (path.startsWith('/api/gift-shop')) {
                response = await handleGiftShopRoutes(request, env, path, method);
            } else if (path.startsWith('/api/game-loop')) {
                response = await handleGameLoopRoutes(request, env, path, method);
            } else if (path.startsWith('/api/help')) {
                response = await handleHelpRagRoutes(request, env, path, method);
            } else if (path.startsWith('/api/system-settings')) {
                response = await handleSystemSettingsRoutes(request, env, path, method);
            } else if (path.startsWith('/api/result-reports')) {
                response = await handleResultReportRoutes(request, env, path, method);
            } else if (path.startsWith('/api/phieu')) {
                response = await handlePhieuRoutes(request, env, path, method);
            } else if (path.startsWith('/api/homework')) {
                const rateLimitRes = await rateLimit(request, env, { windowMs: 60 * 1000, maxRequests: 60 });
                if (rateLimitRes) return addCors(rateLimitRes, request, env);
                response = await handleHomeworkRoutes(request, env, path, method);
            } else if (path.startsWith('/api/analytics')) {
                response = await handleAnalyticsRoutes(request, env, path, method);
            } else if (path.startsWith('/api/test-bank')) {
                response = await handleTestBankRoutes(request, env, path, method);
            } else if (path.startsWith('/api/teacher-ai-quota')) {
                response = await handleTeacherAiQuotaRoutes(request, env, path, method);
            } else if (path.startsWith('/api/live-exam')) {
                response = await handleLiveExamRoutes(request, env, path, method);
            } else if (path.startsWith('/api/notifications')) {
                response = await handleNotificationRoutes(request, env, path, method);
            } else if (path.startsWith('/api/certificate-batches') || path.startsWith('/api/certificates')) {
                response = await handleCertificateRoutes(request, env, path, method);
            } else if (path.startsWith('/api/admin/certificate-templates')) {
                response = await handleAdminCertificateRoutes(request, env, path, method);
            }

            if (response) return addCors(response, request, env);

            return addCors(errorResponse('Not found: ' + path, 404), request, env);
        } catch (error: unknown) {
            return addCors(internalErrorResponse(error, request, {
                context: `${method} ${path}`,
            }), request, env);
        }
    },

    // Scheduled maintenance, reminders, and weekly leaderboard rewards.
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        if (event.cron === '0 23 * * *') {
            await createDueHomeworkReminders(env.DB, new Date());
            return;
        }

        try {
            await checkAndAutoCloseExpiredExams(env.DB);
            if (event.cron !== '0 0 * * 1') return;
            const db = env.DB;
            const lastWeekKey = getLastWeekKey();
            
            // Get top 3 from last week
            const topStudents = await db.prepare(`
                SELECT 
                    s.username,
                    SUM(r.score) as total_score
                FROM results r
                JOIN students s ON s.username = r.student_name
                WHERE strftime('%Y-W%W', r.submitted_at) = ?
                GROUP BY s.username
                ORDER BY total_score DESC
                LIMIT 3
            `).bind(lastWeekKey).all();
            
            if (!topStudents.results || topStudents.results.length === 0) {
                console.log('[Cron] No students found for last week');
                return;
            }
            
            const rewards = [
                { rank: 1, coins: 500, badge: 'weekly_champion_1st' },
                { rank: 2, coins: 300, badge: 'weekly_champion_2nd' },
                { rank: 3, coins: 150, badge: 'weekly_champion_3rd' },
            ];
            
            const now = new Date().toISOString();
            
            for (let i = 0; i < topStudents.results.length; i++) {
                const student = topStudents.results[i] as any;
                const reward = rewards[i];
                
                // Award coins
                await db.prepare('UPDATE students SET coins = coins + ? WHERE username = ?')
                    .bind(reward.coins, student.username).run();
                
                // Unlock badge
                const achId = `ach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                await db.prepare(`
                    INSERT OR IGNORE INTO student_achievement_unlocks 
                    (id, username, achievement_code, unlocked_at, metadata)
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    achId,
                    student.username,
                    reward.badge,
                    now,
                    JSON.stringify({ weekKey: lastWeekKey, rank: reward.rank })
                ).run();
                
                // Log reward history
                const rewardId = `lbrew-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                await db.prepare(`
                    INSERT INTO leaderboard_rewards_history
                    (id, username, period, period_key, rank, coins_awarded, badge_code, awarded_at)
                    VALUES (?, ?, 'weekly', ?, ?, ?, ?, ?)
                `).bind(
                    rewardId,
                    student.username,
                    lastWeekKey,
                    reward.rank,
                    reward.coins,
                    reward.badge,
                    now
                ).run();
                
                console.log(`[Cron] Awarded rank ${reward.rank} to ${student.username}: ${reward.coins} coins + ${reward.badge}`);
            }
            
        } catch (error) {
            console.error('[Cron] Error awarding weekly rewards:', error);
        }
    }
};

// Helper function for cron job
function getLastWeekKey(): string {
    const now = new Date();
    now.setDate(now.getDate() - 7); // Go back 1 week
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Add CORS headers to any response
function addCors(response: Response, request: Request, env: Env): Response {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
        headers.set(key, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

