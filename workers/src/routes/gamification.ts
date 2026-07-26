// Gamification API Routes (Pets, Game State, Shop, Leaderboard)

import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { mapPetData, mapShopItem, parseBody } from '../utils/helpers';
import { verifyJWTMiddleware, isStudent } from '../middleware/jwtAuth';
import { handleResultRewardClaim } from '../gamification/resultRewardClaim';

const ATTENDANCE_BASE_REWARD = { exp: 50, coins: 50 };

const getBangkokDateKey = (date = new Date()): string => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
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

// Week 2: Helper functions for leaderboard
const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getCurrentWeekKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
};

const getLastWeekKey = (): string => {
    const now = new Date();
    now.setDate(now.getDate() - 7); // Go back 1 week
    const year = now.getFullYear();
    const week = getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
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

const applyGameStateReward = async (
    db: D1Database,
    username: string,
    addExp: number,
    addCoins: number
): Promise<{
    newLevel: number;
    newExp: number;
    newExpToNext: number;
    newCoins: number;
    leveledUp: boolean;
    mood: string;
} | null> => {
    const student = await db.prepare('SELECT coins FROM students WHERE username = ?').bind(username).first<any>();
    if (!student) return null;

    await db.prepare('UPDATE students SET coins = coins + ? WHERE username = ?').bind(addCoins, username).run();
    const updatedStu = await db.prepare('SELECT coins FROM students WHERE username = ?').bind(username).first<any>();

    let petRow = await db.prepare('SELECT * FROM user_pets WHERE username = ?').bind(username).first<any>();
    if (!petRow) {
        await db.prepare(
            'INSERT INTO user_pets (username, pet_id, pet_name, level, exp, exp_to_next, mood, items, last_active) VALUES (?, ?, ?, 1, 0, 100, ?, ?, ?)'
        ).bind(username, 'cat_01', 'Mèo Con', 'happy', '[]', new Date().toISOString()).run();
        petRow = { level: 1, exp: 0, exp_to_next: 100 };
    }

    let newExp = Number(petRow.exp) + addExp;
    let newLevel = Number(petRow.level) || 1;
    let leveledUp = false;
    let newExpToNext = Number(petRow.exp_to_next) || 100;

    while (newExp >= newExpToNext) {
        newExp -= newExpToNext;
        newLevel += 1;
        leveledUp = true;
        newExpToNext = 100 + (newLevel - 1) * 20;
    }

    await db.prepare('UPDATE user_pets SET level = ?, exp = ?, exp_to_next = ?, mood = ?, last_active = ? WHERE username = ?')
        .bind(newLevel, newExp, newExpToNext, 'excited', new Date().toISOString(), username).run();

    return {
        newLevel,
        newExp,
        newExpToNext,
        newCoins: Number(updatedStu?.coins) || 0,
        leveledUp,
        mood: 'excited',
    };
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

        const todayDateKey = getBangkokDateKey();
        const weekStartDateKey = getWeekStartDateKey(todayDateKey);
        const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
        const claimedToday = weekClaimDates.includes(todayDateKey);
        const streakDays = calculateAttendanceStreak(weekClaimDates, todayDateKey);
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

        const todayDateKey = getBangkokDateKey();
        const weekStartDateKey = getWeekStartDateKey(todayDateKey);

        const existingClaim = await db.prepare(`
            SELECT id
            FROM attendance_claims
            WHERE username = ?
              AND claim_date = ?
            LIMIT 1
        `).bind(username, todayDateKey).first<any>();

        if (existingClaim) {
            const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
            const streakDays = calculateAttendanceStreak(weekClaimDates, todayDateKey);

            return jsonResponse({
                status: 'success',
                data: {
                    claimed: false,
                    alreadyClaimed: true,
                    claimDates: weekClaimDates,
                    streakDays,
                    attendanceDayNumber: weekClaimDates.length,
                    multiplier: getAttendanceMultiplier(weekClaimDates.length),
                    awardedExp: 0,
                    awardedCoins: 0,
                    message: 'Hôm nay bạn đã điểm danh rồi.',
                    todayDateKey,
                    weekStartDateKey,
                },
            });
        }

        const weekClaimDatesBefore = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
        const attendanceDayNumber = weekClaimDatesBefore.length + 1;
        const multiplier = getAttendanceMultiplier(attendanceDayNumber);
        const awardedExp = ATTENDANCE_BASE_REWARD.exp * multiplier;
        const awardedCoins = ATTENDANCE_BASE_REWARD.coins * multiplier;
        const claimId = `att-${crypto.randomUUID()}`;

        await db.prepare(`
            INSERT INTO attendance_claims (id, username, claim_date, reward_exp, reward_coins, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(claimId, username, todayDateKey, awardedExp, awardedCoins, new Date().toISOString()).run();

        const gameState = await applyGameStateReward(db, username, awardedExp, awardedCoins);
        if (!gameState) {
            await db.prepare('DELETE FROM attendance_claims WHERE id = ?').bind(claimId).run();
            return errorResponse('Student not found', 404);
        }

        const weekClaimDates = await getWeekClaimDates(db, username, weekStartDateKey, todayDateKey);
        const streakDays = calculateAttendanceStreak(weekClaimDates, todayDateKey);

        return jsonResponse({
            status: 'success',
            data: {
                ...gameState,
                claimed: true,
                alreadyClaimed: false,
                claimDates: weekClaimDates,
                streakDays,
                attendanceDayNumber,
                multiplier,
                awardedExp,
                awardedCoins,
                todayDateKey,
                weekStartDateKey,
            },
        });
    }

    // POST /api/game-state/result-reward - Claim an idempotent reward for a saved result
    if (path === '/api/game-state/result-reward' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        return handleResultRewardClaim(db, body, subject);
    }

    // POST /api/game-state - Update game state (add exp + coins)
    if (path === '/api/game-state' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;

        const addExp = Number(body.addExp) || 0;
        const addCoins = Number(body.addCoins) || 0;
        if (!Number.isFinite(addExp) || !Number.isFinite(addCoins) || addExp < 0 || addCoins < 0 || addExp > 500 || addCoins > 250) {
            return errorResponse('Invalid reward amount', 400);
        }

        const result = await applyGameStateReward(db, subject, addExp, addCoins);
        if (!result) return errorResponse('Student not found', 404);

        return jsonResponse({ status: 'success', data: result });
    }

    // POST /api/shop/buy
    if (path === '/api/shop/buy' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (!body.itemId) return errorResponse('Missing itemId');
        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;

        const item = await db.prepare('SELECT * FROM shop_items WHERE item_id = ?').bind(body.itemId).first<any>();
        if (!item) return jsonResponse({ status: 'error', message: 'Item not found' });

        const stu = await db.prepare('SELECT coins FROM students WHERE username = ?').bind(subject).first<any>();
        if (!stu) return jsonResponse({ status: 'error', message: 'Student not found' });

        const currentCoins = Number(stu.coins) || 0;
        const price = Number(item.price) || 0;
        if (currentCoins < price) {
            return jsonResponse({ status: 'error', message: `Không đủ vàng! Cần ${price} nhưng chỉ có ${currentCoins}` });
        }

        // Check already owns
        const petForBuy = await db.prepare('SELECT items FROM user_pets WHERE username = ?').bind(subject).first<any>();
        let currentItems: string[] = [];
        try { currentItems = JSON.parse(petForBuy?.items || '[]'); } catch { currentItems = []; }

        if (currentItems.includes(body.itemId)) {
            return jsonResponse({ status: 'error', message: 'Bé đã có món đồ này rồi!' });
        }

        // Deduct coins and add item
        await db.prepare('UPDATE students SET coins = coins - ? WHERE username = ?').bind(price, subject).run();
        currentItems.push(body.itemId);
        await db.prepare('UPDATE user_pets SET items = ? WHERE username = ?').bind(JSON.stringify(currentItems), subject).run();

        return jsonResponse({
            status: 'success',
            data: { newCoins: currentCoins - price, items: currentItems, purchasedItem: { itemId: body.itemId, name: item.name, price } },
        });
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
            JOIN students s ON s.username = r.student_name
            WHERE strftime('%Y-W%W', r.submitted_at) = ?
            GROUP BY s.username
            ORDER BY total_score DESC
            LIMIT 50
        `).bind(weekKey).all();
        
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
            JOIN students s ON s.username = r.student_name
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
            JOIN students s ON s.username = r.student_name
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
