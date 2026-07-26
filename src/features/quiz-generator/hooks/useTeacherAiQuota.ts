import { useEffect, useState } from 'react';
import { getTeacherAiQuota } from '../../../services/teacherAiQuotaService';
import { DEFAULT_TEACHER_DAILY_AI_LIMIT } from '../domain/quizCreationDefaults';

interface UseTeacherAiQuotaOptions {
    isTeacherAccount: boolean;
    username: string | null;
}

export const useTeacherAiQuota = ({
    isTeacherAccount,
    username,
}: UseTeacherAiQuotaOptions) => {
    const [aiUsageCount, setAiUsageCount] = useState(0);
    const [dailyAiLimit, setDailyAiLimit] = useState(DEFAULT_TEACHER_DAILY_AI_LIMIT);

    const aiUsageRemaining = isTeacherAccount
        ? Math.max(0, dailyAiLimit - aiUsageCount)
        : Number.POSITIVE_INFINITY;
    const hasAiQuota = !isTeacherAccount || aiUsageRemaining > 0;

    const refresh = async () => {
        if (!isTeacherAccount || !username) {
            setAiUsageCount(0);
            setDailyAiLimit(DEFAULT_TEACHER_DAILY_AI_LIMIT);
            return;
        }

        try {
            const quota = await getTeacherAiQuota(username);
            setAiUsageCount(quota.usedCount || 0);
            setDailyAiLimit(quota.dailyLimit || DEFAULT_TEACHER_DAILY_AI_LIMIT);
        } catch {
            console.warn('[AI quota] Không thể đồng bộ hạn mức từ máy chủ.');
        }
    };

    useEffect(() => {
        void refresh();
    }, [isTeacherAccount, username]);

    return {
        aiUsageCount,
        aiUsageRemaining,
        hasAiQuota,
        dailyAiLimit,
        refresh,
    };
};
