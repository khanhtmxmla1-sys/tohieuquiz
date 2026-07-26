import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { expireStaleAiActions, getBangkokDateKey } from '../services/teacherAiQuotaLedger';

const TEACHER_DAILY_AI_LIMIT = 5;

const getTeacherRole = async (db: D1Database, username: string): Promise<'admin' | 'teacher' | null> => {
    const row = await db.prepare('SELECT role FROM teachers WHERE username = ?').bind(username).first<{ role?: string }>();
    const role = String(row?.role || '').trim().toLowerCase();
    if (!role) return null;
    return role === 'admin' ? 'admin' : 'teacher';
};

const getUsedCount = async (db: D1Database, username: string, usageDate: string): Promise<number> => {
    const row = await db.prepare(`
        SELECT used_count
        FROM teacher_ai_daily_usage
        WHERE username = ?
          AND usage_date = ?
        LIMIT 1
    `).bind(username, usageDate).first<{ used_count?: number }>();

    const used = Number(row?.used_count || 0);
    return Number.isFinite(used) && used > 0 ? used : 0;
};

const buildQuotaPayload = (
    role: 'admin' | 'teacher',
    username: string,
    usageDate: string,
    usedCount: number
) => {
    if (role === 'admin') {
        return {
            username,
            role,
            usageDate,
            dailyLimit: null,
            usedCount: 0,
            remaining: null,
            canGenerate: true,
            unlimited: true,
        };
    }

    const remaining = Math.max(0, TEACHER_DAILY_AI_LIMIT - usedCount);
    return {
        username,
        role,
        usageDate,
        dailyLimit: TEACHER_DAILY_AI_LIMIT,
        usedCount,
        remaining,
        canGenerate: remaining > 0,
        unlimited: false,
    };
};

export async function handleTeacherAiQuotaRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    if (!requireTeacher(authResult.user)) return errorResponse('Forbidden', 403);

    const db = env.DB;
    const username = authResult.user.username;

    if (path === '/api/teacher-ai-quota' && method === 'GET') {

        const role = await getTeacherRole(db, username);
        if (!role) return errorResponse('Teacher account not found', 404);

        const usageDate = getBangkokDateKey();
        if (role === 'admin') {
            return jsonResponse({ status: 'success', data: buildQuotaPayload(role, username, usageDate, 0) });
        }

        await expireStaleAiActions(db, username);
        const usedCount = await getUsedCount(db, username, usageDate);

        return jsonResponse({
            status: 'success',
            data: buildQuotaPayload(role, username, usageDate, usedCount),
        });
    }

    if (path === '/api/teacher-ai-quota/consume' && method === 'POST') {
        return jsonResponse({
            status: 'error',
            code: 'AI_QUOTA_CONSUME_MOVED',
            message: 'Hạn mức AI được tính tự động khi yêu cầu AI thành công.',
        }, 410);
    }

    return errorResponse('Not found: ' + path, 404);
}
