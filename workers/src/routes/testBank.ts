import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';

export async function handleTestBankRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    if (!requireTeacher(authResult.user)) return errorResponse('Forbidden', 403);

    const db = env.DB;
    const route = path.replace('/api/test-bank', '');
    const actor = authResult.user.username;
    const isAdmin = authResult.user.role === 'admin';

    try {
        if (method === 'GET' && route.startsWith('/teacher/')) {
            const teacherId = decodeURIComponent(route.split('/').pop() || '');
            if (!isAdmin && teacherId !== actor) return errorResponse('Forbidden', 403);
            const queryResult = await db.prepare(
                'SELECT * FROM test_bank WHERE teacher_id = ? ORDER BY created_at DESC',
            ).bind(teacherId).all<any>();
            const items = (queryResult.results || []).map((row) => ({
                id: row.id as string,
                teacher_id: row.teacher_id as string,
                question_data: JSON.parse(row.question_data as string),
                tags: row.tags ? JSON.parse(row.tags as string) : [],
                created_at: row.created_at as string,
            }));
            return jsonResponse({ items });
        }

        if (method === 'POST' && (route === '' || route === '/')) {
            const data = await request.json() as Record<string, any>;
            const id = String(data.id || '').trim();
            const requestedTeacherId = String(data.teacher_id || '').trim();
            const teacherId = isAdmin ? requestedTeacherId : actor;
            if (!id || !teacherId || !data.question_data) return errorResponse('Missing data', 400);
            if (!isAdmin && requestedTeacherId && requestedTeacherId !== actor) return errorResponse('Forbidden', 403);

            const questionData = typeof data.question_data === 'string'
                ? data.question_data : JSON.stringify(data.question_data);
            const tags = data.tags
                ? (typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags)) : '[]';
            await db.prepare(
                'INSERT INTO test_bank (id, teacher_id, question_data, tags) VALUES (?, ?, ?, ?)',
            ).bind(id, teacherId, questionData, tags).run();
            return jsonResponse({ status: 'success', id });
        }

        if (method === 'DELETE' && /^\/[^/]+$/.test(route)) {
            const id = decodeURIComponent(route.slice(1));
            const existing = await db.prepare('SELECT teacher_id FROM test_bank WHERE id = ? LIMIT 1')
                .bind(id).first<{ teacher_id: string }>();
            if (!existing) return errorResponse('Not found', 404);
            if (!isAdmin && existing.teacher_id !== actor) return errorResponse('Forbidden', 403);
            await db.prepare('DELETE FROM test_bank WHERE id = ?').bind(id).run();
            return jsonResponse({ status: 'success' });
        }

        return errorResponse('Test Bank Route Not Found', 404);
    } catch (error) {
        console.error('Error in test bank:', error);
        return errorResponse('Server internal error', 500);
    }
}
