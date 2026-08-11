import { SYSTEM_CRON } from './scheduling/systemCron';
import { getPreviousWeekKey } from './gameLoop/dateKeys';
import { awardWeeklyLeaderboardRewards } from './gamification/weeklyLeaderboardReward';
import { retryMissingClosedLiveExamRewards } from './gamification/liveExamReward';
// TôHiệuQuiz Workers API - Main Entry Point
// Cloudflare Workers API entry point

import { handleCors, corsHeaders } from './middleware/cors';
import { enforceOriginGuard } from './middleware/originGuard';
import { verifyToken } from './middleware/auth';
import { jsonResponse, errorResponse } from './utils/response';
import { internalErrorResponse } from './utils/internalError';
import { handleTeacherRoutes } from './routes/teachers';
import { handleSecurityCenterRoutes } from './routes/securityCenter';
import { handlePasskeyRoutes } from './routes/passkeys';
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
import { handleMediaUploadRoutes } from './routes/mediaUploads';
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
import { handleClientTelemetryRoute } from './routes/clientTelemetry';
import { handleActionCenterRoutes } from './routes/actionCenter';
import { handleOperationsRoutes } from './routes/operations';
import { Env } from './types';
import { createWorkerFetch } from './router/createWorkerFetch';
import { purgeExpiredRateLimits, rateLimit } from './middleware/rateLimit';
import { mapQuestionForSave, mapAssignment, mapAssignments, handleValidateAnswers } from './utils/helpers';
import { checkAndAutoCloseExpiredExams } from './services/liveExamService';
import { createDueHomeworkReminders } from './parentPortal/deadlineReminderService';
import { createParentEmailProvider } from './parentPortal/emailProvider';
import { runWeeklyParentDigests } from './parentPortal/digestService';
import { purgeExpiredAuthSecurityData } from './services/authSessionService';
import { purgeExpiredWebAuthnChallenges } from './services/webauthnService';

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
    handleSecurityCenterRoutes,
    handlePasskeyRoutes,
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
    handleMediaUploadRoutes,
    handleAnalyticsRoutes,
    handleTestBankRoutes,
    handleTeacherAiQuotaRoutes,
    handleLiveExamRoutes,
    handleNotificationRoutes,
    handleCertificateRoutes,
    handleAdminCertificateRoutes,
    handleMathObservabilityRoutes,
    handleClientErrorRoute,
    handleClientTelemetryRoute,
    handleActionCenterRoutes,
    handleOperationsRoutes,
    handlePhieuSubdomain,
    handlePublicPhieuApi,
    handleParentPortalRoutes,
});

export default {
    fetch,

    // Scheduled maintenance, reminders, and weekly leaderboard rewards.
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        if (event.cron === SYSTEM_CRON.DAILY_SECURITY_AND_REMINDERS) {
            // Dọn bộ đếm rate limit đã hết hạn trước, và tách try/catch riêng: đây là việc
            // vệ sinh, không được phép làm hỏng lượt nhắc hạn bài tập của phụ huynh.
            try {
                const purged = await purgeExpiredRateLimits(env.DB, new Date());
                if (purged > 0) console.log(`[Cron] Purged ${purged} expired rate limit rows`);
            } catch (error) {
                console.error('[Cron] Failed to purge expired rate limits:', error);
            }
            try {
                await purgeExpiredAuthSecurityData(env.DB, new Date());
                await purgeExpiredWebAuthnChallenges(env.DB, new Date());
            } catch (error) {
                console.error('[Cron] Failed to purge expired auth security rows:', error);
            }
            await createDueHomeworkReminders(env.DB, new Date());
            return;
        }

        if (event.cron === SYSTEM_CRON.PARENT_DIGEST) {
            try {
                await runWeeklyParentDigests(env.DB, createParentEmailProvider(env), new Date());
            } catch (error) {
                console.error('[Cron] Parent digest run failed:', error);
            }
            return;
        }

        if (
            event.cron !== SYSTEM_CRON.LIVE_EXAM_SWEEP
            && event.cron !== SYSTEM_CRON.WEEKLY_LEADERBOARD
        ) return;

        try {
            await checkAndAutoCloseExpiredExams(env.DB);
            try {
                const repairedSessions = await retryMissingClosedLiveExamRewards(env.DB);
                if (repairedSessions > 0) {
                    console.log(`[Cron] Repaired live-exam rewards for ${repairedSessions} closed session(s)`);
                }
            } catch (error) {
                console.error('[Cron] Live-exam reward retry failed:', error);
            }

            if (event.cron !== SYSTEM_CRON.WEEKLY_LEADERBOARD) return;
            const lastWeekKey = getPreviousWeekKey();
            const awards = await awardWeeklyLeaderboardRewards(env.DB, lastWeekKey);
            if (awards.length === 0) {
                console.log('[Cron] No students found for last week');
                return;
            }

            for (const award of awards) {
                console.log(
                    `[Cron] Weekly rank ${award.rank} ${award.username}: ${award.coins} coins + ${award.badge}`
                    + (award.alreadyClaimed ? ' (already awarded)' : '')
                );
            }
        } catch (error) {
            console.error('[Cron] Error awarding weekly rewards:', error);
        }
    }
};
