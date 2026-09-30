import { getCurrentDateKey, getCurrentWeekKey, getWeekUtcRange } from '../gameLoop/dateKeys';
// Gamification API Routes (Pets, Game State, Shop, Leaderboard)

import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { mapPetData, mapShopItem, parseBody } from '../utils/helpers';
import { verifyJWTMiddleware, isStudent } from '../middleware/jwtAuth';
import { handleResultRewardClaim } from '../gamification/resultRewardClaim';
import { answerAttendanceAttempt, getAttendanceStatus, startAttendanceAttempt } from '../gamification/attendanceFlow';
import { resolveStudentRewardIdentity } from '../gamification/rewardIdentity';
import { applyStudentReward, parseRewardPayload } from '../gamification/studentRewardLedger';
import { getStudentLeaderboard, type StudentLeaderboardPeriod, type StudentLeaderboardScope } from '../gamification/studentLeaderboard';

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

        const data = await getAttendanceStatus(db, subject);
        if (!data) return errorResponse('Student not found', 404);
        return jsonResponse({ status: 'success', data });
    }

    // POST /api/game-state/attendance-start
    if (path === '/api/game-state/attendance-start' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        try {
            const result = await startAttendanceAttempt(db, subject);
            if ('error' in result) return errorResponse(result.error || 'Attendance request failed', result.status || 500);
            return jsonResponse({ status: 'success', data: result.data });
        } catch (error) {
            console.error('[Attendance] Could not start attempt:', error);
            return errorResponse('Could not start attendance', 500);
        }
    }

    // POST /api/game-state/attendance-answer
    if (path === '/api/game-state/attendance-answer' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        try {
            const result = await answerAttendanceAttempt(db, subject, {
                attemptId: body.attemptId,
                itemId: body.itemId,
                selectedAnswer: body.selectedAnswer,
            });
            if ('error' in result) return errorResponse(result.error || 'Attendance request failed', result.status || 500);
            return jsonResponse({ status: 'success', data: result.data });
        } catch (error) {
            console.error('[Attendance] Could not answer attempt:', error);
            return errorResponse('Could not update attendance', 500);
        }
    }

    // Legacy one-question attendance claim is retired in favor of the two-question attempt flow.
    if (path === '/api/game-state/attendance-claim' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const subject = requireStudentSubject(body.username);
        if (subject instanceof Response) return subject;
        return errorResponse('Attendance claim endpoint has been replaced by attendance-start/attendance-answer', 410);
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

    // GET /api/leaderboard/student - Authenticated student's class/school gold board.
    if (path === '/api/leaderboard/student' && method === 'GET') {
        if (!isStudent(user)) return errorResponse('Forbidden: Student access required', 403);

        const requestedScope = url.searchParams.get('scope') || 'class';
        const requestedPeriod = url.searchParams.get('period') || 'week';
        if (requestedScope !== 'class' && requestedScope !== 'school') {
            return errorResponse('Invalid leaderboard scope', 400);
        }
        if (requestedPeriod !== 'week' && requestedPeriod !== 'all') {
            return errorResponse('Invalid leaderboard period', 400);
        }

        const data = await getStudentLeaderboard(db, user.username, {
            scope: requestedScope as StudentLeaderboardScope,
            period: requestedPeriod as StudentLeaderboardPeriod,
        });
        if (!data) return errorResponse('Student not found', 404);
        return jsonResponse({ status: 'success', data });
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
