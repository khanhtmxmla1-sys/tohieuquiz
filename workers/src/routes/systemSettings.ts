import { Env } from '../types';
import { errorResponse, jsonResponse } from '../utils/response';
import { parseBody } from '../utils/helpers';
import { isTransientD1Error, withD1Retry } from '../utils/d1';
import { requireAdmin, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { auditStatement } from '../utils/audit';

type SystemSettingRow = {
    setting_key: string;
    setting_value: string;
    updated_at: string;
};

const AI_ASSISTANT_KEY = 'ai_assistant_enabled';
const UNIFIED_NOTIFICATIONS_KEY = 'unified_notifications_v1';

const parseBool = (value: unknown, fallback = false): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
    }
    return fallback;
};

export async function handleSystemSettingsRoutes(request: Request, env: Env, path: string, method: string): Promise<Response | null> {
    if (path !== '/api/system-settings') return null;

    const db = env.DB;

    if (method === 'GET') {
        let rows: SystemSettingRow[] = [];
        try {
            const result = await withD1Retry(
                () => db.prepare(`
                    SELECT setting_key, setting_value, updated_at
                    FROM system_settings
                    WHERE setting_key IN (?, ?)
                `).bind(AI_ASSISTANT_KEY, UNIFIED_NOTIFICATIONS_KEY).all<SystemSettingRow>(),
                'GET /api/system-settings'
            );
            rows = result.results || [];
        } catch (error) {
            if (!isTransientD1Error(error) && !String(error).includes('no such table')) {
                throw error;
            }
            console.warn('[system-settings] Returning defaults after D1 read failure:', error);
        }

        const settings = new Map(rows.map((row) => [row.setting_key, row]));
        const aiRow = settings.get(AI_ASSISTANT_KEY);
        const unifiedRow = settings.get(UNIFIED_NOTIFICATIONS_KEY);
        const aiAssistantEnabled = parseBool(aiRow?.setting_value ?? 'false', false);
        const unifiedNotificationsEnabled = parseBool(unifiedRow?.setting_value ?? 'false', false);
        const updatedAt = rows
            .map((row) => row.updated_at)
            .filter(Boolean)
            .sort()
            .at(-1) || '';
        return jsonResponse({
            status: 'success',
            data: {
                aiAssistantEnabled,
                unified_notifications_v1: unifiedNotificationsEnabled,
                unifiedNotificationsEnabled,
                updatedAt,
                degraded: rows.length === 0,
            },
        });
    }

    if (method === 'POST') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        if (!requireAdmin(authResult.user)) return errorResponse('Forbidden', 403);

        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (typeof body.aiAssistantEnabled !== 'boolean') {
            return errorResponse('aiAssistantEnabled must be a boolean', 400);
        }
        if (typeof body.unifiedNotificationsEnabled !== 'boolean') {
            return errorResponse('unifiedNotificationsEnabled must be a boolean', 400);
        }

        const aiAssistantEnabled = parseBool(body.aiAssistantEnabled, false);
        const unifiedNotificationsEnabled = parseBool(body.unifiedNotificationsEnabled, false);
        const now = new Date().toISOString();

        await db.batch([
            db.prepare(`
                INSERT INTO system_settings (setting_key, setting_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = excluded.updated_at
            `).bind(AI_ASSISTANT_KEY, aiAssistantEnabled ? 'true' : 'false', now),
            db.prepare(`
                INSERT INTO system_settings (setting_key, setting_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = excluded.updated_at
            `).bind(UNIFIED_NOTIFICATIONS_KEY, unifiedNotificationsEnabled ? 'true' : 'false', now),
            auditStatement(db, {
                actorUsername: authResult.user.username,
                action: 'SYSTEM_SETTINGS_UPDATED',
                targetType: 'system_setting',
                targetId: 'notification_and_ai_settings',
                requestId: request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID(),
                before: null,
                after: { aiAssistantEnabled, unifiedNotificationsEnabled },
            }),
        ]);

        return jsonResponse({
            status: 'success',
            data: {
                aiAssistantEnabled,
                unified_notifications_v1: unifiedNotificationsEnabled,
                unifiedNotificationsEnabled,
                updatedAt: now,
            },
        });
    }

    return errorResponse('Method not allowed', 405);
}
