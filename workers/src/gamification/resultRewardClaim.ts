import { calculateResultReward } from './resultRewardPolicy';
import {
    applyStudentReward,
    loadStudentRewardWallet,
    parseRewardPayload,
    type StudentRewardLedgerRow,
} from './studentRewardLedger';
import { errorResponse, jsonResponse } from '../utils/response';

interface ResultRewardPayload extends Record<string, unknown> {
    resultId?: string;
    awardedExp?: number;
    awardedCoins?: number;
    historicalExp?: number;
    historicalCoins?: number;
}

const resolveAwardedDelta = (
    ledger: StudentRewardLedgerRow,
    payload: ResultRewardPayload,
) => ({
    awardedExp: Number(payload.awardedExp ?? payload.historicalExp ?? ledger.exp_delta) || 0,
    awardedCoins: Number(payload.awardedCoins ?? payload.historicalCoins ?? ledger.coins_delta) || 0,
});

export const handleResultRewardClaim = async (
    db: D1Database,
    body: any,
    username: string,
): Promise<Response> => {
    const resultId = String(body.resultId || '').trim();
    if (!resultId) return errorResponse('Missing resultId', 400);

    const student = await db.prepare(`
        SELECT id, username
        FROM students
        WHERE username = ?
        LIMIT 1
    `).bind(username).first<any>();
    if (!student?.id) return errorResponse('Student not found', 404);

    const savedResult = await db.prepare(`
        SELECT id, student_id, class_id, score, correct_count, total_questions
        FROM results
        WHERE id = ?
        LIMIT 1
    `).bind(resultId).first<any>();
    if (!savedResult) return errorResponse('Result not found', 404);

    if (!savedResult.student_id || String(savedResult.student_id) !== String(student.id)) {
        return errorResponse('Forbidden: Result does not belong to this student', 403);
    }

    const reward = calculateResultReward({
        score: Number(savedResult.score) || 0,
        correctCount: Number(savedResult.correct_count) || 0,
        totalQuestions: Number(savedResult.total_questions) || 0,
    });

    let beforeWallet;
    try {
        beforeWallet = await loadStudentRewardWallet(db, String(student.id));
    } catch {
        return errorResponse('Student not found', 404);
    }

    try {
        const rewardResult = await applyStudentReward(db, {
            studentId: String(student.id),
            username,
            sourceType: 'QUIZ_RESULT',
            sourceKey: resultId,
            rewardType: 'COINS_EXP',
            coinsDelta: reward.coins,
            expDelta: reward.exp,
            payload: {
                resultId,
                awardedExp: reward.exp,
                awardedCoins: reward.coins,
            },
        });
        const storedPayload = parseRewardPayload<ResultRewardPayload>(rewardResult.ledger, {});
        const awarded = resolveAwardedDelta(rewardResult.ledger, storedPayload);

        return jsonResponse({
            status: 'success',
            alreadyClaimed: rewardResult.alreadyClaimed,
            reward: {
                type: 'COINS_EXP',
                coins: awarded.awardedCoins,
                exp: awarded.awardedExp,
            },
            data: {
                ...awarded,
                wallet: {
                    coins: rewardResult.wallet.coins,
                    totalExp: rewardResult.wallet.totalExp,
                    level: rewardResult.wallet.level,
                    exp: rewardResult.wallet.exp,
                    expToNext: rewardResult.wallet.expToNext,
                },
                newLevel: rewardResult.wallet.level,
                newExp: rewardResult.wallet.exp,
                newExpToNext: rewardResult.wallet.expToNext,
                newCoins: rewardResult.wallet.coins,
                leveledUp: !rewardResult.alreadyClaimed
                    && rewardResult.wallet.level > beforeWallet.level,
                mood: rewardResult.wallet.mood,
                alreadyClaimed: rewardResult.alreadyClaimed,
            },
        });
    } catch (error) {
        console.error('[ResultReward] Atomic reward claim failed:', error);
        return errorResponse('Could not apply reward', 500);
    }
};
