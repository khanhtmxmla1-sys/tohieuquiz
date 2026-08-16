import { getCurrentDateKey, getCurrentWeekKey, getWeekUtcRange } from '../gameLoop/dateKeys';
// Gamification API Routes (Pets, Game State, Shop, Leaderboard)

import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { mapPetData, mapShopItem, parseBody } from '../utils/helpers';
import { verifyJWTMiddleware, isStudent } from '../middleware/jwtAuth';
import { handleResultRewardClaim } from '../gamification/resultRewardClaim';
import { resolveStudentRewardIdentity } from '../gamification/rewardIdentity';
import { applyStudentReward, parseRewardPayload } from '../gamification/studentRewardLedger';

const ATTENDANCE_BASE_REWARD = { exp: 50, coins: 50 };

const cleanAttendanceOptionText = (value: unknown): string => String(value ?? '')
    .replace(/^\s*[A-Z]\s*[\.\)\:\-]\s*/i, '')
    .trim();

const parseAttendanceOptions = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((option) => String(option ?? '').trim()).filter(Boolean);
    try {
        const parsed = JSON.parse(String(value ?? '[]'));
        return Array.isArray(parsed)
            ? parsed.map((option) => String(option ?? '').trim()).filter(Boolean)
            : [];
    } catch {
        return [];
    }
};

const resolveAttendanceCorrectLabel = (answer: unknown, options: string[]): string | null => {
    let raw = String(answer ?? '').trim();
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 1) raw = String(parsed[0] ?? '').trim();
    } catch {
        // Legacy scalar answers are intentionally handled below.
    }
    const direct = raw.toUpperCase().match(/^([A-Z])(?:[\.\)\:\-].*)?$/);
    if (direct) return direct[1];
    if (/^\d+$/.test(raw)) {
        const index = Number(raw);
        if (index >= 0 && index < options.length) return String.fromCharCode(65 + index);
    }
    const normalized = cleanAttendanceOptionText(raw).toUpperCase();
    const index = options.findIndex(
        (option) => cleanAttendanceOptionText(option).toUpperCase() === normalized,
    );
    return index >= 0 ? String.fromCharCode(65 + index) : null;
};

const verifyAttendanceAnswer = async (
    db: D1Database,
    quizId: unknown,
    questionId: unknown,
    selectedAnswer: unknown
): Promise<boolean> => {
    const canonicalQuizId = String(quizId ?? '').trim();
    const canonicalQuestionId = String(questionId ?? '').trim();
    const selectedLabel = String(selectedAnswer ?? '').trim().toUpperCase();
    if (!canonicalQuizId || !canonicalQuestionId || !/^[A-Z]$/.test(selectedLabel)) return false;

    const row = await db.prepare(`
        SELECT id, quiz_id, type, options, correct_answer
        FROM questions
        WHERE id = ? AND quiz_id = ?
        LIMIT 1
    `).bind(canonicalQuestionId, canonicalQuizId).first<any>();
    if (!row || String(row.type || '').toUpperCase() !== 'MCQ') return false;

    const options = parseAttendanceOptions(row.options);
    const correctLabel = resolveAttendanceCorrectLabel(row.correct_answer, options);
    return Boolean(correctLabel && selectedLabel === correctLabel);
};

const parseDateKeyToUtc = (dateKey: string): Date => {
    const [year, month, day] = String(dateKey || '').split('-').map((v) => Number(v || 0));
    return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatUtcDateKey = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getWeekStartDateKey = (dateKey: string): string => {
    const date = parseDateKeyToUtc(dateKey);
    const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setUTCDate(date.getUTCDate() + offsetToMonday);
    return formatUtcDateKey(date);
};

const getAttendanceMultiplier = (attendanceDayNumber: number): number => {
    if (attendanceDayNumber === 3) return 2;
    if (attendanceDayNumber === 5) return 3;
    if (attendanceDayNumber === 7) return 5;
    return 1;
};

const calculateAttendanceStreak = (days: string[], endDateKey: string): number => {
    if (!endDateKey || days.length === 0) return 0;

    const daySet = new Set(days);
    let streak = 0;
    const cursor = parseDateKeyToUtc(endDateKey);

    while (daySet.has(formatUtcDateKey(cursor))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
};

const ensureAttendanceTable = async (db: D1Database): Promise<void> => {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS attendance_claims (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            claim_date TEXT NOT NULL,
            reward_exp INTEGER NOT NULL,
            reward_coins INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date
        ON attendance_claims(username, claim_date)
    `).run();

    await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_attendance_user_week
        ON attendance_claims(username, claim_date DESC)
    `).run();
};

const getWeekClaimDates = async (
    db: D1Database,
    username: string,
    weekStartDateKey: string,
    todayDateKey: string
): Promise<string[]> => {
    const rows = await db.prepare(`
        SELECT claim_date
        FROM attendance_claims
        WHERE username = ?
          AND claim_date >= ?
          AND claim_date <= ?
        ORDER BY claim_date ASC
    `).bind(username, weekStartDateKey, todayDateKey).all<any>();

    return rows.results.map((r: any) => String(r.claim_date || '').trim()).filter(Boolean);
};

const getClaimDatesThroughDate = async (
    db: D1Database,
    username: string,
    todayDateKey: string
): Promise<string[]> => {
    const rows = await db.prepare(`
        SELECT claim_date
        FROM attendance_claims
        WHERE username = ? AND claim_date <= ?
        ORDER BY claim_date ASC
    `).bind(username, todayDateKey).all<any>();

    return rows.results.map((r: any) => String(r.claim_date || '').trim()).filter(Boolean);
};

export async function handleGamificationRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    const db = env.DB;
    const url = new URL(request.url);

    const requireStudentSubject = (suppliedUsername?: unknown): string | Response => {
        if (!isStudent(user)) return errorResponse('Forbidden: Student access required', 403);
        const supplied = String(suppliedUsername || '').trim();
        if (supplied && supplied !== user.username) {
            return errorResponse('Forbidden: You can only access your own game state', 403);
        }
        return user.username;
    };

    // GET /api/pets?username=X
    if (path === '/api/pets' && method === 'GET') {
        const subject = requireStudentSubject(url.searchParams.get('username'));
        if (subject instanceof Response) return subject;
        const username = subject;

        let pet = await db.prepare('SELECT * FROM user_pets WHERE username = ?').bind(username).first<import('../types').PetData>();
        if (!pet) {
            // Create default pet
            const petId = url.searchParams.get('petId') || 'cat_01';
            const petName = url.searchParams.get('petName') || 'Mèo Con';
            await db.prepare(
                'INSERT INTO user_pets (username, pet_id, pet_name, level, exp, exp_to_next, mood, items, last_active) VALUES (?, ?, ?, 1, 0, 100, ?, ?, ?)'
            ).bind(username, petId, petName, 'happy', '[]', new Date().toISOString()).run();
            pet = { pet_id: petId, pet_name: petName, level: 1, exp: 0, exp_to_next: 100, mood: 'happy', items: '[]', last_active: new Date().toISOString(), image_url: '' };
        }

        const stu = await db.prepare('SELECT coins FROM students WHERE username = ?').bind(username).first<any>();
        const shopItems = await db.prepare('SELECT * FROM shop_items').all<import('../types').ShopItem>();

        return jsonResponse({
            status: 'success',
            data: {
                pet: mapPetData(pet),
                coins: stu ? Number(stu.coins) || 0 : 0,
                shopItems: shopItems.results.map(mapShopItem),
            },
        });
    }

    // GET /api/game-state/attendance-status?username=X
    if (path === '/api/game-state/attendance-status' && method === 'GET') {
        const subject = requireStudentSubject(url.searchParams.get('username'));
        if (subject instanceof Response) return subject;
        const username = subject;

        await ensureAttendanceTable(db);

        const todayDateKey = getCurrentDateKey();
        const weekStartDateKey = getWeekStartDateKey(todayDateKey);
        const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
        const claimDatesThroughToday = await getClaimDatesThroughDate(db, username, todayDateKey);
        const claimedToday = weekClaimDates.includes(todayDateKey);
        const streakDays = calculateAttendanceStreak(claimDatesThroughToday, todayDateKey);
        const attendanceDayNumber = claimedToday ? weekClaimDates.length : (weekClaimDates.length + 1);
        const multiplier = getAttendanceMultiplier(attendanceDayNumber);

        return jsonResponse({
            status: 'success',
            data: {
                claimedToday,
                claimDates: weekClaimDates,
                streakDays,
                attendanceDayNumber,
                nextRewardExp: ATTENDANCE_BASE_REWARD.exp * multiplier,
                nextRewardCoins: ATTENDANCE_BASE_REWARD.coins * multiplier,
                todayDateKey,
                weekStartDateKey,
            },
        });
    }

    // POST /api/game-state/attendance-claim
    if (path === '/api/game-state/attendance-claim' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        const username = subject;

        await ensureAttendanceTable(db);
        const identity = await resolveStudentRewardIdentity(db, username);
        if (!identity) return errorResponse('Student not found', 404);

        const todayDateKey = getCurrentDateKey();
        const weekStartDateKey = getWeekStartDateKey(todayDateKey);
        const existingClaim = await db.prepare(`
            SELECT id, reward_exp, reward_coins
            FROM attendance_claims
            WHERE username = ? AND claim_date = ?
            LIMIT 1
        `).bind(username, todayDateKey).first<any>();

        if (existingClaim) {
            const ledger = await db.prepare(`
                SELECT id, student_id, source_type, source_key, reward_type,
                       coins_delta, exp_delta, payload_json, created_at
                FROM student_reward_ledger
                WHERE student_id = ? AND source_type = 'DAILY_ATTENDANCE' AND source_key = ?
                LIMIT 1
            `).bind(identity.studentId, todayDateKey).first<any>();
            if (!ledger) return errorResponse('Attendance claim state is inconsistent', 409);

            const stored = parseRewardPayload<any>(ledger, {});
            const awardedExp = Number(stored.awardedExp ?? stored.historicalExp ?? existingClaim.reward_exp) || 0;
            const awardedCoins = Number(stored.awardedCoins ?? stored.historicalCoins ?? existingClaim.reward_coins) || 0;
            const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
            const claimDatesThroughToday = await getClaimDatesThroughDate(db, username, todayDateKey);
            const streakDays = calculateAttendanceStreak(claimDatesThroughToday, todayDateKey);
            const attendanceDayNumber = Number(stored.attendanceDayNumber) || weekClaimDates.length;
            const multiplier = Number(stored.multiplier) || getAttendanceMultiplier(attendanceDayNumber);
            const wallet = await db.prepare(`
                SELECT s.coins, COALESCE(p.level, 1) AS level, COALESCE(p.exp, 0) AS exp,
                       COALESCE(p.exp_to_next, 100) AS exp_to_next, COALESCE(p.mood, 'happy') AS mood
                FROM students s
                LEFT JOIN user_pets p ON p.username = s.username
                WHERE s.id = ?
                LIMIT 1
            `).bind(identity.studentId).first<any>();

            return jsonResponse({
                status: 'success',
                alreadyClaimed: true,
                reward: { type: 'COINS_EXP', coins: awardedCoins, exp: awardedExp },
                data: {
                    claimed: false,
                    alreadyClaimed: true,
                    claimDates: weekClaimDates,
                    streakDays,
                    attendanceDayNumber,
                    multiplier,
                    awardedExp,
                    awardedCoins,
                    newLevel: Number(wallet?.level) || 1,
                    newExp: Number(wallet?.exp) || 0,
                    newExpToNext: Number(wallet?.exp_to_next) || 100,
                    newCoins: Number(wallet?.coins) || 0,
                    mood: String(wallet?.mood || 'happy'),
                    message: 'Hôm nay bạn đã điểm danh rồi.',
                    todayDateKey,
                    weekStartDateKey,
                },
            });
        }

        const answerVerified = await verifyAttendanceAnswer(
            db,
            body.quizId,
            body.questionId,
            body.selectedAnswer
        );
        if (!answerVerified) return errorResponse('Attendance answer could not be verified', 400);

        const weekClaimDatesBefore = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
        const attendanceDayNumber = weekClaimDatesBefore.length + 1;
        const multiplier = getAttendanceMultiplier(attendanceDayNumber);
        const awardedExp = ATTENDANCE_BASE_REWARD.exp * multiplier;
        const awardedCoins = ATTENDANCE_BASE_REWARD.coins * multiplier;
        const claimId = `att-${crypto.randomUUID()}`;
        const createdAt = new Date().toISOString();

        try {
            const rewardResult = await applyStudentReward(db, {
                ...identity,
                sourceType: 'DAILY_ATTENDANCE',
                sourceKey: todayDateKey,
                rewardType: 'COINS_EXP',
                coinsDelta: awardedCoins,
                expDelta: awardedExp,
                payload: {
                    awardedExp,
                    awardedCoins,
                    attendanceDayNumber,
                    multiplier,
                    todayDateKey,
                    weekStartDateKey,
                },
                extraStatements: [
                    db.prepare(`
                        INSERT INTO attendance_claims
                        (id, username, claim_date, reward_exp, reward_coins, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(claimId, username, todayDateKey, awardedExp, awardedCoins, createdAt),
                ],
            });
            const stored = parseRewardPayload<any>(rewardResult.ledger, {});
            const storedAwardedExp = Number(stored.awardedExp ?? stored.historicalExp ?? rewardResult.ledger.exp_delta) || 0;
            const storedAwardedCoins = Number(stored.awardedCoins ?? stored.historicalCoins ?? rewardResult.ledger.coins_delta) || 0;
            const storedAttendanceDayNumber = Number(stored.attendanceDayNumber) || attendanceDayNumber;
            const storedMultiplier = Number(stored.multiplier) || multiplier;
            const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
            const claimDatesThroughToday = await getClaimDatesThroughDate(db, username, todayDateKey);
            const streakDays = calculateAttendanceStreak(claimDatesThroughToday, todayDateKey);

            return jsonResponse({
                status: 'success',
                alreadyClaimed: rewardResult.alreadyClaimed,
                reward: { type: 'COINS_EXP', coins: storedAwardedCoins, exp: storedAwardedExp },
                data: {
                    claimed: !rewardResult.alreadyClaimed,
                    alreadyClaimed: rewardResult.alreadyClaimed,
                    claimDates: weekClaimDates,
                    streakDays,
                    attendanceDayNumber: storedAttendanceDayNumber,
                    multiplier: storedMultiplier,
                    awardedExp: storedAwardedExp,
                    awardedCoins: storedAwardedCoins,
                    newLevel: rewardResult.wallet.level,
                    newExp: rewardResult.wallet.exp,
                    newExpToNext: rewardResult.wallet.expToNext,
                    newCoins: rewardResult.wallet.coins,
                    mood: rewardResult.wallet.mood,
                    todayDateKey,
                    weekStartDateKey,
                },
            });
        } catch (error) {
            console.error('[Attendance] Atomic claim failed:', error);
            return errorResponse('Could not apply attendance reward', 500);
        }
    }

    // POST /api/game-state/result-reward - Claim an idempotent reward for a saved result
    if (path === '/api/game-state/result-reward' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        return handleResultRewardClaim(db, body, subject);
    }

    // POST /api/game-state - Retired: rewards must come from server-verified sources.
    if (path === '/api/game-state' && method === 'POST') {
        return errorResponse('Legacy game-state mutation endpoint has been retired', 410);
    }

    // POST /api/shop/buy
    if (path === '/api/shop/buy' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (!body.itemId) return errorResponse('Missing itemId');
        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        const itemId = String(body.itemId || '').trim();
        const identity = await resolveStudentRewardIdentity(db, subject);
        if (!identity) return jsonResponse({ status: 'error', message: 'Student not found' });

        const existingReceipt = await db.prepare(`
            SELECT id, student_id, source_type, source_key, reward_type,
                   coins_delta, exp_delta, payload_json, created_at
            FROM student_reward_ledger
            WHERE student_id = ? AND source_type = 'PET_SHOP_PURCHASE' AND source_key = ?
            LIMIT 1
        `).bind(identity.studentId, itemId).first<any>();
        if (existingReceipt) {
            const stored = parseRewardPayload<any>(existingReceipt, {});
            const pet = await db.prepare('SELECT items FROM user_pets WHERE username = ?').bind(subject).first<any>();
            const wallet = await db.prepare('SELECT coins FROM students WHERE id = ?').bind(identity.studentId).first<any>();
            let items: string[] = [];
            try { items = JSON.parse(pet?.items || '[]'); } catch { items = []; }
            return jsonResponse({
                status: 'success',
                alreadyClaimed: true,
                reward: { type: 'ITEM_PURCHASE', item: stored.purchasedItem || { itemId } },
                data: {
                    wallet: { coins: Number(wallet?.coins) || 0 },
                    newCoins: Number(wallet?.coins) || 0,
                    items,
                    purchasedItem: stored.purchasedItem || { itemId },
                },
            });
        }

        const item = await db.prepare('SELECT * FROM shop_items WHERE item_id = ?').bind(itemId).first<any>();
        if (!item) return jsonResponse({ status: 'error', message: 'Item not found' });

        const stu = await db.prepare('SELECT coins FROM students WHERE id = ?').bind(identity.studentId).first<any>();
        if (!stu) return jsonResponse({ status: 'error', message: 'Student not found' });

        const currentCoins = Number(stu.coins) || 0;
        const price = Math.max(0, Math.floor(Number(item.price) || 0));
        if (currentCoins < price) {
            return jsonResponse({ status: 'error', message: `Không đủ vàng! Cần ${price} nhưng chỉ có ${currentCoins}` });
        }

        // Check already owns
        const petForBuy = await db.prepare('SELECT items FROM user_pets WHERE username = ?').bind(subject).first<any>();
        let currentItems: string[] = [];
        try { currentItems = JSON.parse(petForBuy?.items || '[]'); } catch { currentItems = []; }

        if (currentItems.includes(itemId)) {
            return jsonResponse({ status: 'error', message: 'Bé đã có món đồ này rồi!' });
        }

        const now = new Date().toISOString();
        const purchasedItem = { itemId, name: String(item.name || itemId), price };
        try {
            const rewardResult = await applyStudentReward(db, {
                ...identity,
                sourceType: 'PET_SHOP_PURCHASE',
                sourceKey: itemId,
                rewardType: 'ITEM_PURCHASE',
                coinsDelta: -price,
                expDelta: 0,
                payload: { purchasedItem },
                extraStatements: [
                    db.prepare(`
                        INSERT OR IGNORE INTO user_pets (
                          username, pet_id, pet_name, level, exp, exp_to_next, total_exp,
                          mood, items, last_active
                        ) VALUES (?, 'cat_01', 'Mèo Con', 1, 0, 100, 0, 'happy', '[]', ?)
                    `).bind(subject, now),
                    db.prepare(`
                        UPDATE user_pets
                        SET items = json_insert(
                              CASE WHEN json_valid(items) THEN items ELSE '[]' END,
                              '$[#]', ?
                            ),
                            last_active = ?
                        WHERE username = ?
                    `).bind(itemId, now, subject),
                ],
            });
            const stored = parseRewardPayload<any>(rewardResult.ledger, { purchasedItem });
            const pet = await db.prepare('SELECT items FROM user_pets WHERE username = ?').bind(subject).first<any>();
            let items: string[] = [];
            try { items = JSON.parse(pet?.items || '[]'); } catch { items = []; }
            return jsonResponse({
                status: 'success',
                alreadyClaimed: rewardResult.alreadyClaimed,
                reward: { type: 'ITEM_PURCHASE', item: stored.purchasedItem || purchasedItem },
                data: {
                    wallet: { coins: rewardResult.wallet.coins },
                    newCoins: rewardResult.wallet.coins,
                    items,
                    purchasedItem: stored.purchasedItem || purchasedItem,
                },
            });
        } catch (error) {
            if (String((error as Error)?.message || error).includes('INSUFFICIENT_COIN_BALANCE')) {
                const wallet = await db.prepare('SELECT coins FROM students WHERE id = ?').bind(identity.studentId).first<any>();
                const available = Number(wallet?.coins) || 0;
                return jsonResponse({ status: 'error', message: `Không đủ vàng! Cần ${price} nhưng chỉ có ${available}` });
            }
            console.error('[PetShop] Atomic purchase failed:', error);
            return errorResponse('Could not complete purchase', 500);
        }
    }

    // GET /api/leaderboard
    if (path === '/api/leaderboard' && method === 'GET') {
        const pets = await db.prepare(`
            SELECT p.*, s.full_name, s.avatar
            FROM user_pets p
            LEFT JOIN students s ON p.username = s.username
            ORDER BY p.level DESC, p.exp DESC
            LIMIT 10
        `).all();

        const leaderboard = pets.results.map((p: any) => ({
            username: p.username, fullName: p.full_name || p.username,
            petId: p.pet_id, petName: p.pet_name,
            level: Number(p.level) || 1, exp: Number(p.exp) || 0,
            avatar: p.avatar || '',
        }));
        return jsonResponse({ status: 'success', data: leaderboard });
    }

    // GET /api/leaderboard/top-gold
    if (path === '/api/leaderboard/top-gold' && method === 'GET') {
        const topGold = await db.prepare(`
            SELECT username, full_name, avatar, coins
            FROM students
            ORDER BY coins DESC
            LIMIT 10
        `).all();

        const leaderboard = topGold.results.map((s: any) => ({
            username: s.username,
            fullName: s.full_name || s.username,
            avatar: s.avatar || '',
            coins: Number(s.coins) || 0,
        }));
        return jsonResponse({ status: 'success', data: leaderboard });
    }

    // === WEEK 2: LEADERBOARD CATEGORIES ===

    // GET /api/leaderboard/weekly - Weekly leaderboard (reset mỗi tuần)
    if (path === '/api/leaderboard/weekly' && method === 'GET') {
        const weekKey = url.searchParams.get('week') || getCurrentWeekKey();
        const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);

        const rows = await db.prepare(`
            SELECT
                s.username,
                s.full_name,
                s.class_id,
                s.avatar,
                SUM(r.score) as total_score,
                COUNT(r.id) as quiz_count,
                SUM(r.correct_count) as total_correct
            FROM results r
            JOIN students s ON s.id = r.student_id
            WHERE r.submitted_at >= ?
              AND r.submitted_at < ?
            GROUP BY s.username
            ORDER BY total_score DESC
            LIMIT 50
        `).bind(startIso, endIsoExclusive).all();
        
        return jsonResponse(rows.results || []);
    }

    // GET /api/leaderboard/speed - Speed leaderboard (avg time ratio)
    if (path === '/api/leaderboard/speed' && method === 'GET') {
        const rows = await db.prepare(`
            SELECT 
                s.username,
                s.full_name,
                s.class_id,
                s.avatar,
                AVG(CAST(r.time_taken AS REAL) / CAST(r.time_limit AS REAL)) as avg_speed_ratio,
                COUNT(r.id) as quiz_count
            FROM results r
            JOIN students s ON s.id = r.student_id
            WHERE r.time_taken > 0 AND r.time_limit > 0
            GROUP BY s.username
            HAVING quiz_count >= 5
            ORDER BY avg_speed_ratio ASC
            LIMIT 50
        `).all();
        
        return jsonResponse(rows.results || []);
    }

    // GET /api/leaderboard/accuracy - Accuracy leaderboard (avg correct percentage)
    if (path === '/api/leaderboard/accuracy' && method === 'GET') {
        const rows = await db.prepare(`
            SELECT 
                s.username,
                s.full_name,
                s.class_id,
                s.avatar,
                AVG(CAST(r.correct_count AS REAL) / CAST(r.total_questions AS REAL) * 100) as avg_accuracy,
                COUNT(r.id) as quiz_count
            FROM results r
            JOIN students s ON s.id = r.student_id
            WHERE r.total_questions > 0
            GROUP BY s.username
            HAVING quiz_count >= 5
            ORDER BY avg_accuracy DESC
            LIMIT 50
        `).all();
        
        return jsonResponse(rows.results || []);
    }

    // GET /api/leaderboard/streak - Streak leaderboard
    if (path === '/api/leaderboard/streak' && method === 'GET') {
        const rows = await db.prepare(`
            SELECT 
                s.username,
                s.full_name,
                s.class_id,
                s.avatar,
                gp.daily_streak
            FROM student_game_profiles gp
            JOIN students s ON s.username = gp.username
            WHERE gp.daily_streak > 0
            ORDER BY gp.daily_streak DESC
            LIMIT 50
        `).all();
        
        return jsonResponse(rows.results || []);
    }

    return errorResponse('Not found: ' + path, 404);
}
