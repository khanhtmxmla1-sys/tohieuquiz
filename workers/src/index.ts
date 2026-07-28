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
import { handleClientErrorRoute } from './routes/clientErrors';
import { handleActionCenterRoutes } from './routes/actionCenter';
import { Env } from './types';
import { createWorkerFetch } from './router/createWorkerFetch';
import { purgeExpiredRateLimits, rateLimit } from './middleware/rateLimit';
import { mapQuestionForSave, mapAssignment, mapAssignments, handleValidateAnswers } from './utils/helpers';
import { checkAndAutoCloseExpiredExams } from './services/liveExamService';
import { createDueHomeworkReminders } from './parentPortal/deadlineReminderService';

const fetch = createWorkerFetch({
    handleCors,
    corsHeaders,
    enforceOriginGuard,
    verifyToken,
    jsonResponse,
    errorResponse,
    internalErrorResponse,
    rateLimit,
    handleTeacherRoutes,
    handleLogoutRoute,
    handleQuizDraftRoutes,
    handleQuizRoutes,
    handleResultRoutes,
    handleClassroomRoutes,
    handleGamificationRoutes,
    handleAnnouncementRoutes,
    handleAiTutorRoutes,
    handleAiProxy,
    handlePracticeRoutes,
    handleGiftShopRoutes,
    handleGameLoopRoutes,
    handleHelpRagRoutes,
    handleSystemSettingsRoutes,
    handleResultReportRoutes,
    handlePhieuRoutes,
    handleHomeworkRoutes,
    handleAnalyticsRoutes,
    handleTestBankRoutes,
    handleTeacherAiQuotaRoutes,
    handleLiveExamRoutes,
    handleNotificationRoutes,
    handleCertificateRoutes,
    handleAdminCertificateRoutes,
    handleMathObservabilityRoutes,
    handleClientErrorRoute,
    handleActionCenterRoutes,
    handlePhieuSubdomain,
    handlePublicPhieuApi,
    handleParentPortalRoutes,
});

export default {
    fetch,

    // Scheduled maintenance, reminders, and weekly leaderboard rewards.
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        if (event.cron === '0 23 * * *') {
            // Dọn bộ đếm rate limit đã hết hạn trước, và tách try/catch riêng: đây là việc
            // vệ sinh, không được phép làm hỏng lượt nhắc hạn bài tập của phụ huynh.
            // Dọn bộ đếm rate limit đã hết hạn trước, và tách try/catch riêng: đây là việc
            // vệ sinh, không được phép làm hỏng lượt nhắc hạn bài tập của phụ huynh.
            try {
                const purged = await purgeExpiredRateLimits(env.DB, new Date());
                if (purged > 0) console.log(`[Cron] Purged ${purged} expired rate limit rows`);
            } catch (error) {
                console.error('[Cron] Failed to purge expired rate limits:', error);
            }
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
