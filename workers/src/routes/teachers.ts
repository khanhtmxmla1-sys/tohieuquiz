import { Env } from '../types';
import { jsonResponse, errorResponse, hashPassword } from '../utils/response';
import { parseBody } from '../utils/helpers';
import { signJWT, JWTPayload } from '../utils/jwt';
import { buildAuthSessionData, withAuthCookie, withClearedAuthCookie } from '../utils/authSession';
import { verifyJWTMiddleware, requireAdmin, requireTeacher } from '../middleware/jwtAuth';
import {
    generateTemporaryPassword,
    hashPasswordPbkdf2,
    isPbkdf2Password,
    validateNewPassword,
    verifyPasswordPbkdf2,
} from '../utils/password';
import { checkLoginLimit, clearLoginFailures, recordLoginFailure } from '../utils/loginRateLimit';
import { auditStatement, writeAuditLog } from '../utils/audit';

type TeacherRow = {
    username: string;
    password: string;
    full_name: string;
    role: string;
    class: string;
    status: 'ACTIVE' | 'DISABLED';
    must_change_password: number;
    token_version: number;
    password_changed_at: string | null;
    last_login_at: string | null;
    disabled_at: string | null;
    disabled_by: string | null;
    disabled_reason: string | null;
    created_at: string | null;
    updated_at: string | null;
};

function requestId(request: Request): string {
    return request.headers.get('cf-ray') || request.headers.get('x-request-id') || crypto.randomUUID();
}

async function passwordMatches(password: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
    if (isPbkdf2Password(stored)) {
        return { valid: await verifyPasswordPbkdf2(password, stored), legacy: false };
    }
    const legacyHash = await hashPassword(password);
    return { valid: stored === password || stored === legacyHash, legacy: true };
}

async function createSessionToken(teacher: TeacherRow, env: Env, purpose: 'session' | 'password_change'): Promise<string> {
    return signJWT({
        id: teacher.username,
        username: teacher.username,
        role: teacher.role === 'admin' ? 'admin' : 'teacher',
        fullName: teacher.full_name,
        classId: teacher.class,
        school_id: teacher.username,
        tokenVersion: Number(teacher.token_version),
        purpose,
    }, env.JWT_SECRET, purpose === 'password_change' ? '15m' : '7d');
}

function legacyResponse(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Deprecation', 'true');
    headers.set('Sunset', 'Wed, 30 Sep 2026 00:00:00 GMT');
    headers.set('Link', '</api/admin/teachers>; rel="successor-version"');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function noStore(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function verifyCurrentPassword(body: Record<string, any>, teacher: TeacherRow): Promise<Response | null> {
    if (typeof body.currentPassword !== 'string') return errorResponse('Vui lòng nhập mật khẩu hiện tại.', 400);
    const match = await passwordMatches(body.currentPassword, teacher.password);
    return match.valid ? null : errorResponse('Mật khẩu hiện tại không đúng.', 403);
}

export async function handleTeacherRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const db = env.DB;

    if (path === '/api/login' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!username || !password) return errorResponse('Thiếu tên đăng nhập hoặc mật khẩu.');

        const limited = await checkLoginLimit(request, env, username);
        if (limited) return limited;

        const teacher = await db.prepare('SELECT * FROM teachers WHERE username = ? LIMIT 1')
            .bind(username).first<TeacherRow>();
        const match = teacher ? await passwordMatches(password, teacher.password) : { valid: false, legacy: false };
        if (!teacher || teacher.status === 'DISABLED' || !match.valid) {
            const limiterError = await recordLoginFailure(request, env, username);
            if (limiterError) return limiterError;
            return errorResponse('Sai tên đăng nhập hoặc mật khẩu.', 401);
        }
        if (!env.JWT_SECRET) return errorResponse('Authentication service unavailable', 503);

        const limiterError = await clearLoginFailures(request, env, username);
        if (limiterError) return limiterError;
        const requiresPasswordChange = match.legacy || Number(teacher.must_change_password) === 1;
        const purpose = requiresPasswordChange ? 'password_change' : 'session';
        const jwtToken = await createSessionToken(teacher, env, purpose);
        if (!requiresPasswordChange) {
            await db.prepare('UPDATE teachers SET last_login_at = ?, updated_at = ? WHERE username = ?')
                .bind(new Date().toISOString(), new Date().toISOString(), username).run();
        }

        return withAuthCookie(jsonResponse({
            status: 'success',
            data: buildAuthSessionData(env, {
                username: teacher.username,
                fullName: teacher.full_name,
                role: teacher.role,
                class: teacher.class,
                requiresPasswordChange,
            }, jwtToken),
        }), jwtToken, requiresPasswordChange ? 15 * 60 : undefined);
    }

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);

    if (path === '/api/account/change-password' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const passwordError = validateNewPassword(body.newPassword);
        if (passwordError) return errorResponse(passwordError, 400);
        const teacher = await db.prepare('SELECT * FROM teachers WHERE username = ? LIMIT 1')
            .bind(user.username).first<TeacherRow>();
        if (!teacher || teacher.status !== 'ACTIVE') return errorResponse('Tài khoản không khả dụng.', 401);
        if (user.purpose !== 'password_change') {
            const currentError = await verifyCurrentPassword(body, teacher);
            if (currentError) return currentError;
        }
        const encoded = await hashPasswordPbkdf2(body.newPassword);
        const now = new Date().toISOString();
        const nextVersion = Number(teacher.token_version) + 1;
        await db.prepare(`
            UPDATE teachers
            SET password = ?, must_change_password = 0, token_version = ?,
                password_changed_at = ?, last_login_at = ?, updated_at = ?
            WHERE username = ?
        `).bind(encoded, nextVersion, now, now, now, teacher.username).run();
        const updated = { ...teacher, password: encoded, must_change_password: 0, token_version: nextVersion };
        const token = await createSessionToken(updated, env, 'session');
        await writeAuditLog(db, {
            actorUsername: teacher.username,
            action: 'ACCOUNT_PASSWORD_CHANGED',
            targetType: 'teacher',
            targetId: teacher.username,
            requestId: requestId(request),
        });
        return withAuthCookie(jsonResponse({
            status: 'success',
            data: buildAuthSessionData(env, {}, token),
        }), token);
    }

    if (path === '/api/account/me' && method === 'GET') {
        const teacher = await db.prepare(`
            SELECT username, full_name, role, status, must_change_password, last_login_at
            FROM teachers WHERE username = ? LIMIT 1
        `).bind(user.username).first<any>();
        const classes = await db.prepare(`
            SELECT id, name FROM classes
            WHERE teacher_username = ? AND archived_at IS NULL
            ORDER BY name
        `).bind(user.username).all<{ id: string; name: string }>();
        return jsonResponse({ status: 'success', data: {
            username: teacher.username,
            fullName: teacher.full_name,
            role: teacher.role,
            status: teacher.status,
            mustChangePassword: Boolean(teacher.must_change_password),
            lastLoginAt: teacher.last_login_at,
            classes: classes.results || [],
        } });
    }

    if (path === '/api/account/logout-all' && method === 'POST') {
        const now = new Date().toISOString();
        await db.prepare('UPDATE teachers SET token_version = token_version + 1, updated_at = ? WHERE username = ?')
            .bind(now, user.username).run();
        await writeAuditLog(db, {
            actorUsername: user.username,
            action: 'ACCOUNT_LOGOUT_ALL',
            targetType: 'teacher',
            targetId: user.username,
            requestId: requestId(request),
        });
        return withClearedAuthCookie(jsonResponse({ status: 'success' }));
    }

    const isLegacy = path === '/api/teachers' || path.startsWith('/api/teachers/');
    const isAdminRoute = path === '/api/admin/teachers' || path.startsWith('/api/admin/teachers/');
    if (!isLegacy && !isAdminRoute) return errorResponse('Not found: ' + path, 404);
    if (!requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);

    const finish = (response: Response) => isLegacy ? legacyResponse(response) : response;
    const base = isLegacy ? '/api/teachers' : '/api/admin/teachers';

    if (path === base && method === 'GET') {
        const url = new URL(request.url);
        const search = (url.searchParams.get('search') || '').trim();
        const role = url.searchParams.get('role') || '';
        const status = url.searchParams.get('status') || '';
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 25)));
        const where: string[] = ['1 = 1'];
        const bindings: unknown[] = [];
        if (search) {
            where.push('(t.username LIKE ? OR t.full_name LIKE ?)');
            bindings.push(`%${search}%`, `%${search}%`);
        }
        if (role === 'admin' || role === 'teacher') { where.push('t.role = ?'); bindings.push(role); }
        if (status === 'ACTIVE' || status === 'DISABLED') { where.push('t.status = ?'); bindings.push(status); }
        const whereSql = where.join(' AND ');
        const total = await db.prepare(`SELECT COUNT(*) AS count FROM teachers t WHERE ${whereSql}`)
            .bind(...bindings).first<{ count: number }>();
        const rows = await db.prepare(`
            SELECT t.username, t.full_name, t.role, t.class, t.status, t.must_change_password,
                   t.last_login_at, t.password_changed_at, t.disabled_at,
                   COUNT(CASE WHEN c.archived_at IS NULL THEN 1 END) AS class_count
            FROM teachers t
            LEFT JOIN classes c ON c.teacher_username = t.username
            WHERE ${whereSql}
            GROUP BY t.username
            ORDER BY t.status, t.full_name, t.username
            LIMIT ? OFFSET ?
        `).bind(...bindings, pageSize, (page - 1) * pageSize).all<any>();
        return finish(jsonResponse({ status: 'success', data: {
            items: (rows.results || []).map((teacher) => ({
                username: teacher.username,
                fullName: teacher.full_name,
                full_name: teacher.full_name,
                role: teacher.role,
                class: teacher.class,
                status: teacher.status,
                mustChangePassword: Boolean(teacher.must_change_password),
                lastLoginAt: teacher.last_login_at,
                passwordChangedAt: teacher.password_changed_at,
                disabledAt: teacher.disabled_at,
                classCount: Number(teacher.class_count || 0),
            })),
            page,
            pageSize,
            total: Number(total?.count || 0),
        } }));
    }

    if (path === base && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
        const role = body.role === 'admin' ? 'admin' : 'teacher';
        if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username) || !fullName) {
            return errorResponse('Tên đăng nhập hoặc họ tên không hợp lệ.');
        }
        if (await db.prepare('SELECT username FROM teachers WHERE username = ?').bind(username).first()) {
            return errorResponse('Tên đăng nhập đã tồn tại.', 409);
        }
        const temporaryPassword = generateTemporaryPassword();
        const encoded = await hashPasswordPbkdf2(temporaryPassword);
        const now = new Date().toISOString();
        await db.batch([
            db.prepare(`
                INSERT INTO teachers
                (username, password, full_name, role, class, status, must_change_password,
                 token_version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, 1, ?, ?)
            `).bind(username, encoded, fullName, role, body.teacherClass || '', now, now),
            auditStatement(db, {
                actorUsername: user.username,
                action: 'TEACHER_CREATED',
                targetType: 'teacher', targetId: username, requestId: requestId(request),
                after: { username, fullName, role },
            }),
        ]);
        return finish(noStore(jsonResponse({ status: 'success', data: { username, temporaryPassword } }, 201)));
    }

    if (path === `${base}/reset-passwords` && method === 'POST') {
        const rows = await db.prepare(`
            SELECT username, full_name
            FROM teachers
            WHERE role = 'teacher'
            ORDER BY full_name, username
        `).all<{ username: string; full_name: string }>();
        const teachers = rows.results || [];
        if (teachers.length === 0) return errorResponse('Không có tài khoản giáo viên để đặt lại mật khẩu.', 404);

        const now = new Date().toISOString();
        const credentials = await Promise.all(teachers.map(async (teacher) => {
            const temporaryPassword = generateTemporaryPassword();
            const encoded = await hashPasswordPbkdf2(temporaryPassword);
            return { ...teacher, temporaryPassword, encoded };
        }));

        const statements: D1PreparedStatement[] = [];
        for (const credential of credentials) {
            statements.push(
                db.prepare(`
                    UPDATE teachers SET password = ?, must_change_password = 1,
                        token_version = token_version + 1, password_changed_at = NULL, updated_at = ?
                    WHERE username = ? AND role = 'teacher'
                `).bind(credential.encoded, now, credential.username),
                auditStatement(db, {
                    actorUsername: user.username,
                    action: 'TEACHER_PASSWORD_RESET',
                    targetType: 'teacher',
                    targetId: credential.username,
                    requestId: requestId(request),
                    after: { bulk: true },
                }),
            );
        }
        await db.batch(statements);

        return noStore(jsonResponse({ status: 'success', data: {
            count: credentials.length,
            credentials: credentials.map(({ username, full_name, temporaryPassword }) => ({
                username,
                fullName: full_name,
                temporaryPassword,
            })),
        } }));
    }

    const suffix = path.slice(base.length + 1);
    const [encodedUsername, action] = suffix.split('/');
    const targetUsername = decodeURIComponent(encodedUsername || '');
    if (!targetUsername) return errorResponse('Missing username');
    const target = await db.prepare('SELECT * FROM teachers WHERE username = ? LIMIT 1')
        .bind(targetUsername).first<TeacherRow>();
    if (!target) return errorResponse('Không tìm thấy tài khoản.', 404);

    if (!action && method === 'PUT') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        const nextRole = body.role === 'admin' ? 'admin' : body.role === 'teacher' ? 'teacher' : target.role;
        if (target.role === 'admin' && nextRole !== 'admin') {
            const admins = await db.prepare("SELECT COUNT(*) AS count FROM teachers WHERE role = 'admin' AND status = 'ACTIVE'")
                .first<{ count: number }>();
            if (Number(admins?.count || 0) <= 1) return errorResponse('Không thể hạ quyền quản trị viên cuối cùng.', 409);
        }
        const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim() : target.full_name;
        const teacherClass = body.teacherClass !== undefined ? String(body.teacherClass) : target.class;
        const now = new Date().toISOString();
        await db.batch([
            db.prepare('UPDATE teachers SET full_name = ?, role = ?, class = ?, updated_at = ? WHERE username = ?')
                .bind(fullName, nextRole, teacherClass, now, targetUsername),
            auditStatement(db, {
                actorUsername: user.username, action: 'TEACHER_UPDATED', targetType: 'teacher',
                targetId: targetUsername, requestId: requestId(request),
                before: { fullName: target.full_name, role: target.role, class: target.class },
                after: { fullName, role: nextRole, class: teacherClass },
            }),
        ]);
        return finish(jsonResponse({ status: 'success' }));
    }

    if (action === 'reset-password' && method === 'POST') {
        const temporaryPassword = generateTemporaryPassword();
        const encoded = await hashPasswordPbkdf2(temporaryPassword);
        const now = new Date().toISOString();
        await db.batch([
            db.prepare(`
                UPDATE teachers SET password = ?, must_change_password = 1,
                    token_version = token_version + 1, password_changed_at = NULL, updated_at = ?
                WHERE username = ?
            `).bind(encoded, now, targetUsername),
            auditStatement(db, {
                actorUsername: user.username, action: 'TEACHER_PASSWORD_RESET', targetType: 'teacher',
                targetId: targetUsername, requestId: requestId(request),
            }),
        ]);
        return noStore(jsonResponse({ status: 'success', data: { temporaryPassword } }));
    }

    if ((action === 'disable' && method === 'POST') || (!action && method === 'DELETE')) {
        if (targetUsername === user.username) return errorResponse('Bạn không thể vô hiệu hóa chính mình.', 409);
        if (target.role === 'admin') {
            const admins = await db.prepare("SELECT COUNT(*) AS count FROM teachers WHERE role = 'admin' AND status = 'ACTIVE'")
                .first<{ count: number }>();
            if (Number(admins?.count || 0) <= 1) return errorResponse('Không thể vô hiệu hóa quản trị viên cuối cùng.', 409);
        }
        const body = await parseBody(request) || {};
        const owned = await db.prepare('SELECT COUNT(*) AS count FROM classes WHERE teacher_username = ? AND archived_at IS NULL')
            .bind(targetUsername).first<{ count: number }>();
        const classCount = Number(owned?.count || 0);
        const transferTo = typeof body.transferTo === 'string' ? body.transferTo.trim() : '';
        if (classCount > 0 && !transferTo) return errorResponse('Phải chọn giáo viên nhận lớp trước khi vô hiệu hóa.', 409);
        if (transferTo) {
            const recipient = await db.prepare("SELECT username FROM teachers WHERE username = ? AND status = 'ACTIVE'")
                .bind(transferTo).first();
            if (!recipient || transferTo === targetUsername) return errorResponse('Giáo viên nhận lớp không hợp lệ.', 400);
        }
        const now = new Date().toISOString();
        const statements: D1PreparedStatement[] = [];
        if (classCount > 0) {
            statements.push(db.prepare('UPDATE classes SET teacher_username = ? WHERE teacher_username = ? AND archived_at IS NULL')
                .bind(transferTo, targetUsername));
        }
        statements.push(db.prepare(`
            UPDATE teachers SET status = 'DISABLED', disabled_at = ?, disabled_by = ?, disabled_reason = ?,
                token_version = token_version + 1, updated_at = ? WHERE username = ?
        `).bind(now, user.username, String(body.reason || ''), now, targetUsername));
        statements.push(auditStatement(db, {
            actorUsername: user.username, action: 'TEACHER_DISABLED', targetType: 'teacher',
            targetId: targetUsername, requestId: requestId(request),
            before: { status: target.status, classCount }, after: { status: 'DISABLED', transferTo },
        }));
        await db.batch(statements);
        return finish(jsonResponse({ status: 'success' }));
    }

    if (action === 'enable' && method === 'POST') {
        const now = new Date().toISOString();
        await db.batch([
            db.prepare(`
                UPDATE teachers SET status = 'ACTIVE', disabled_at = NULL, disabled_by = NULL,
                    disabled_reason = NULL, token_version = token_version + 1, updated_at = ?
                WHERE username = ?
            `).bind(now, targetUsername),
            auditStatement(db, {
                actorUsername: user.username, action: 'TEACHER_ENABLED', targetType: 'teacher',
                targetId: targetUsername, requestId: requestId(request),
                before: { status: target.status }, after: { status: 'ACTIVE' },
            }),
        ]);
        return jsonResponse({ status: 'success' });
    }

    return errorResponse('Not found: ' + path, 404);
}
