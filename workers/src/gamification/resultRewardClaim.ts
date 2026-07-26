import { calculateResultReward } from './resultRewardPolicy';
import { errorResponse, jsonResponse } from '../utils/response';

interface StoredRewardReceipt {
    reward_exp: number;
    reward_coins: number;
    new_level: number;
    new_exp: number;
    new_exp_to_next: number;
    new_coins: number;
    leveled_up: number;
    mood: string;
}

interface NextGameState {
    newLevel: number;
    newExp: number;
    newExpToNext: number;
    newCoins: number;
    leveledUp: boolean;
    mood: string;
}

const normalizeStudentIdentity = (value: unknown): string => String(value || '').trim().toLowerCase();

const calculateNextGameState = (
    currentCoins: number,
    pet: any | null,
    rewardExp: number,
    rewardCoins: number,
): NextGameState => {
    let newLevel = Math.max(1, Number(pet?.level) || 1);
    let newExp = Math.max(0, Number(pet?.exp) || 0) + rewardExp;
    let newExpToNext = Math.max(1, Number(pet?.exp_to_next) || 100);
    let leveledUp = false;

    while (newExp >= newExpToNext) {
        newExp -= newExpToNext;
        newLevel += 1;
        leveledUp = true;
        newExpToNext = 100 + (newLevel - 1) * 20;
    }

    return {
        newLevel,
        newExp,
        newExpToNext,
        newCoins: Math.max(0, currentCoins) + rewardCoins,
        leveledUp,
        mood: 'excited',
    };
};

const receiptResponse = (receipt: StoredRewardReceipt, alreadyClaimed: boolean): Response => jsonResponse({
    status: 'success',
    data: {
        awardedExp: Number(receipt.reward_exp) || 0,
        awardedCoins: Number(receipt.reward_coins) || 0,
        newLevel: Number(receipt.new_level) || 1,
        newExp: Number(receipt.new_exp) || 0,
        newExpToNext: Number(receipt.new_exp_to_next) || 100,
        newCoins: Number(receipt.new_coins) || 0,
        leveledUp: Boolean(receipt.leveled_up),
        mood: String(receipt.mood || 'excited'),
        alreadyClaimed,
    },
});

export const handleResultRewardClaim = async (
    db: D1Database,
    body: any,
    username: string,
): Promise<Response> => {
    const resultId = String(body.resultId || '').trim();
    if (!resultId) return errorResponse('Missing resultId', 400);

    const loadExistingReceipt = () => db.prepare(`
        SELECT reward_exp, reward_coins, new_level, new_exp,
               new_exp_to_next, new_coins, leveled_up, mood
        FROM reward_receipts
        WHERE username = ? AND activity_type = ? AND activity_id = ?
        LIMIT 1
    `).bind(username, 'QUIZ_RESULT', resultId).first<StoredRewardReceipt>();

    const existingReceipt = await loadExistingReceipt();
    if (existingReceipt) return receiptResponse(existingReceipt, true);

    const student = await db.prepare(`
        SELECT students.full_name, students.coins, classes.name AS class_name
        FROM students
        LEFT JOIN classes ON classes.id = students.class_id
        WHERE students.username = ?
        LIMIT 1
    `).bind(username).first<any>();
    if (!student) return errorResponse('Student not found', 404);

    const savedResult = await db.prepare(`
        SELECT id, student_name, class_name, score, correct_count, total_questions
        FROM results
        WHERE id = ?
        LIMIT 1
    `).bind(resultId).first<any>();
    if (!savedResult) return errorResponse('Result not found', 404);

    const ownsResult = normalizeStudentIdentity(savedResult.student_name) === normalizeStudentIdentity(student.full_name)
        && normalizeStudentIdentity(savedResult.class_name) === normalizeStudentIdentity(student.class_name);
    if (!ownsResult) return errorResponse('Forbidden: Result does not belong to this student', 403);

    const reward = calculateResultReward({
        score: Number(savedResult.score) || 0,
        correctCount: Number(savedResult.correct_count) || 0,
        totalQuestions: Number(savedResult.total_questions) || 0,
    });
    const pet = await db.prepare('SELECT * FROM user_pets WHERE username = ?').bind(username).first<any>();
    const gameState = calculateNextGameState(Number(student.coins) || 0, pet, reward.exp, reward.coins);
    const receiptId = `result-reward-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    const statements: D1PreparedStatement[] = [
        db.prepare(`
            INSERT INTO reward_receipts (
                id, username, activity_type, activity_id, reward_exp, reward_coins,
                new_level, new_exp, new_exp_to_next, new_coins, leveled_up, mood, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            receiptId,
            username,
            'QUIZ_RESULT',
            resultId,
            reward.exp,
            reward.coins,
            gameState.newLevel,
            gameState.newExp,
            gameState.newExpToNext,
            gameState.newCoins,
            gameState.leveledUp ? 1 : 0,
            gameState.mood,
            createdAt,
        ),
        db.prepare('UPDATE students SET coins = ? WHERE username = ?')
            .bind(gameState.newCoins, username),
    ];

    if (pet) {
        statements.push(
            db.prepare(`
                UPDATE user_pets
                SET level = ?, exp = ?, exp_to_next = ?, mood = ?, last_active = ?
                WHERE username = ?
            `).bind(
                gameState.newLevel,
                gameState.newExp,
                gameState.newExpToNext,
                gameState.mood,
                createdAt,
                username,
            ),
        );
    } else {
        statements.push(
            db.prepare(`
                INSERT INTO user_pets (
                    username, pet_id, pet_name, level, exp, exp_to_next, mood, items, last_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                username,
                'cat_01',
                'Mèo Con',
                gameState.newLevel,
                gameState.newExp,
                gameState.newExpToNext,
                gameState.mood,
                '[]',
                createdAt,
            ),
        );
    }

    try {
        await db.batch(statements);
    } catch (error) {
        const racedReceipt = await loadExistingReceipt();
        if (racedReceipt) return receiptResponse(racedReceipt, true);
        console.error('[ResultReward] Atomic reward claim failed:', error);
        return errorResponse('Could not apply reward', 500);
    }

    return receiptResponse({
        reward_exp: reward.exp,
        reward_coins: reward.coins,
        new_level: gameState.newLevel,
        new_exp: gameState.newExp,
        new_exp_to_next: gameState.newExpToNext,
        new_coins: gameState.newCoins,
        leveled_up: gameState.leveledUp ? 1 : 0,
        mood: gameState.mood,
    }, false);
};
