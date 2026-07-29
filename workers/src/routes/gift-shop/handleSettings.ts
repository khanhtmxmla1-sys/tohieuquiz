import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { getRequestId } from '../../utils/logger';
import { errorResponse, jsonResponse } from '../../utils/response';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { appendEvent } from './events';
import { nowIso, toBool } from './values';

interface ScopeContext {
    schoolId: string;
    classId: string;
}

const resolveContext = async (env: Env, user: { id?: string; username: string; role: string; classId?: string; school_id?: string }): Promise<ScopeContext> => {
    if (user.role === 'student') {
        const row = await env.DB.prepare(`
            SELECT s.class_id, c.teacher_username AS school_id
            FROM students s JOIN classes c ON c.id=s.class_id
            WHERE s.id=? AND COALESCE(s.archived_at, '')=''
        `).bind(user.id || '').first<any>();
        return { schoolId: String(row?.school_id || ''), classId: String(row?.class_id || '') };
    }
    const access = getActorAccessFromUser(user as any);
    if (access.teacherClass) {
        const row = await env.DB.prepare(`
            SELECT id, teacher_username FROM classes
            WHERE (id=? OR name=?) AND COALESCE(archived_at, '')='' LIMIT 1
        `).bind(access.teacherClass, access.teacherClass).first<any>();
        if (row) return { schoolId: String(row.teacher_username || access.schoolId), classId: String(row.id || '') };
    }
    return { schoolId: access.schoolId, classId: '' };
};

const effectiveSetting = async (env: Env, context: ScopeContext) => {
    const row = await env.DB.prepare(`
        SELECT scope_type, school_id, class_id, is_open, closed_reason, updated_by, updated_at
        FROM gift_shop_scope_settings
        WHERE school_id=? AND is_open=0 AND (scope_type='SCHOOL' OR (scope_type='CLASS' AND class_id=?))
        ORDER BY CASE scope_type WHEN 'CLASS' THEN 0 ELSE 1 END
        LIMIT 1
    `).bind(context.schoolId, context.classId).first<any>();
    return {
        isOpen: !row,
        closedReason: row?.closed_reason || '',
        closedScope: row?.scope_type || null,
        schoolId: context.schoolId,
        classId: context.classId,
    };
};

export const handleSettings = async (request: Request, env: Env, method: string): Promise<Response> => {
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    const context = await resolveContext(env, userOrResponse);

    if (method === 'GET') {
        const effective = await effectiveSetting(env, context);
        if (userOrResponse.role === 'admin') {
            const rows = await env.DB.prepare(`
                SELECT * FROM gift_shop_scope_settings ORDER BY school_id, scope_type, class_id
            `).all<any>();
            return jsonResponse({ effective, settings: rows.results || [] });
        }
        return jsonResponse({ effective, settings: [] });
    }

    if (method !== 'PUT') return errorResponse('Method not allowed', 405);
    if (!requireTeacher(userOrResponse)) return errorResponse('Forbidden', 403);
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const access = getActorAccessFromUser(userOrResponse);
    const scopeType = String(body.scopeType || 'CLASS').trim().toUpperCase();
    if (!access.isAdmin && scopeType !== 'CLASS') return errorResponse('Forbidden', 403);
    if (scopeType !== 'SCHOOL' && scopeType !== 'CLASS') return errorResponse('Invalid scope type');

    const schoolId = access.isAdmin ? String(body.schoolId || context.schoolId).trim() : context.schoolId;
    const classId = scopeType === 'CLASS'
        ? (access.isAdmin ? String(body.classId || context.classId).trim() : context.classId)
        : '';
    if (!schoolId || (scopeType === 'CLASS' && !classId)) return errorResponse('Missing shop scope');
    const isOpen = toBool(body.isOpen);
    const reason = isOpen ? '' : String(body.closedReason || '').trim();
    if (!isOpen && !reason) return errorResponse('Vui lòng nhập lý do đóng tiệm.');
    const now = nowIso();
    await env.DB.prepare(`
        INSERT INTO gift_shop_scope_settings
          (id, scope_type, school_id, class_id, is_open, closed_reason, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope_type, school_id, class_id) DO UPDATE SET
          is_open=excluded.is_open, closed_reason=excluded.closed_reason,
          updated_by=excluded.updated_by, updated_at=excluded.updated_at
    `).bind(
        `gset-${crypto.randomUUID().slice(0, 8)}`, scopeType, schoolId, classId,
        isOpen ? 1 : 0, reason, userOrResponse.username, now,
    ).run();
    await appendEvent(env.DB, {
        type: 'SHOP_SCOPE_UPDATED',
        actor: userOrResponse.username,
        requestId: getRequestId(request),
        metadata: { scopeType, schoolId, classId, isOpen, reason },
    });
    return jsonResponse({ effective: await effectiveSetting(env, { schoolId, classId }), settings: [] });
};
