import {
    MAX_MANUAL_QUIZ_DRAFT_BYTES,
    isValidManualQuizDraftId,
    parsePutManualQuizDraftRequest,
    utf8ByteLength,
    type ManualQuizDraftConflictPayload,
    type ManualQuizDraftPayload,
    type ManualQuizDraftRecord,
} from '../../../shared/manual-quiz-draft.contract';
import type { Env } from '../types';
import { requireOwnership, requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../utils/response';

interface QuizDraftRow {
    id: string;
    owner_username: string;
    quiz_id: string | null;
    draft_json: string;
    revision: number;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
}

const DRAFT_PATH_PREFIX = '/api/quiz-drafts/';

const parseDraftId = (path: string): string | null => {
    if (!path.startsWith(DRAFT_PATH_PREFIX)) return null;
    const encoded = path.slice(DRAFT_PATH_PREFIX.length);
    if (!encoded || encoded.includes('/')) return null;
    try {
        const draftId = decodeURIComponent(encoded);
        return isValidManualQuizDraftId(draftId) ? draftId : null;
    } catch {
        return null;
    }
};

const parsePersistedDraft = (row: QuizDraftRow): ManualQuizDraftPayload => {
    const draft = JSON.parse(row.draft_json) as ManualQuizDraftPayload;
    return {
        ...draft,
        draftId: row.id,
        quizId: row.quiz_id || undefined,
        ownerUsername: row.owner_username,
        revision: Number(row.revision),
        updatedAt: row.updated_at,
    };
};

const mapDraftRow = (row: QuizDraftRow): ManualQuizDraftRecord => ({
    id: row.id,
    ownerUsername: row.owner_username,
    quizId: row.quiz_id || undefined,
    revision: Number(row.revision),
    draft: parsePersistedDraft(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at || undefined,
});

const selectDraft = async (db: D1Database, draftId: string): Promise<QuizDraftRow | null> =>
    db.prepare(`
        SELECT id, owner_username, quiz_id, draft_json, revision,
               created_at, updated_at, expires_at
        FROM quiz_drafts
        WHERE id = ?
        LIMIT 1
    `).bind(draftId).first<QuizDraftRow>();

const conflictResponse = (current: QuizDraftRow): Response => {
    const payload: ManualQuizDraftConflictPayload = {
        status: 'error',
        code: 'DRAFT_CONFLICT',
        message: 'Bản nháp đã được cập nhật ở nơi khác. Vui lòng chọn phiên bản muốn tiếp tục.',
        current: mapDraftRow(current),
    };
    return jsonResponse(payload, 409);
};

const oversizedResponse = (): Response => jsonResponse({
    status: 'error',
    code: 'DRAFT_TOO_LARGE',
    message: `Bản nháp vượt quá giới hạn ${Math.round(MAX_MANUAL_QUIZ_DRAFT_BYTES / 1_000_000)} MB.`,
}, 413);

export async function handleQuizDraftRoutes(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response> {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    if (!requireTeacher(user)) {
        return errorResponse('Forbidden: Teacher or admin access required', 403);
    }

    const draftId = parseDraftId(path);
    if (!draftId) return errorResponse('Mã bản nháp không hợp lệ.', 400);

    if (method === 'GET') {
        const current = await selectDraft(env.DB, draftId);
        if (!current) return errorResponse('Không tìm thấy bản nháp.', 404);
        if (!requireOwnership(user, current.owner_username)) {
            return errorResponse('Forbidden: You do not own this draft', 403);
        }
        return jsonResponse(mapDraftRow(current));
    }

    if (method === 'PUT') {
        const contentLength = Number(request.headers.get('Content-Length') || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_MANUAL_QUIZ_DRAFT_BYTES) {
            return oversizedResponse();
        }

        const rawBody = await request.text();
        if (utf8ByteLength(rawBody) > MAX_MANUAL_QUIZ_DRAFT_BYTES) {
            return oversizedResponse();
        }

        let body: unknown;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return errorResponse('JSON bản nháp không hợp lệ.', 400);
        }

        const parsed = parsePutManualQuizDraftRequest(body, draftId);
        if (!parsed.ok) {
            return jsonResponse({
                status: 'error',
                code: parsed.error.code,
                message: parsed.error.message,
            }, 400);
        }

        const current = await selectDraft(env.DB, draftId);
        const now = new Date().toISOString();

        if (!current) {
            if (parsed.value.expectedRevision !== 0) {
                return jsonResponse({
                    status: 'error',
                    code: 'DRAFT_CONFLICT',
                    message: 'Bản nháp trên máy chủ không còn tồn tại.',
                    current: null,
                }, 409);
            }

            const revision = 1;
            const normalizedDraft: ManualQuizDraftPayload = {
                ...parsed.value.draft,
                draftId,
                ownerUsername: user.username,
                revision,
                updatedAt: now,
            };
            const quizId = normalizedDraft.quizId || null;

            await env.DB.prepare(`
                INSERT INTO quiz_drafts (
                    id, owner_username, quiz_id, draft_json, revision,
                    created_at, updated_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                draftId,
                user.username,
                quizId,
                JSON.stringify(normalizedDraft),
                revision,
                now,
                now,
                null,
            ).run();

            const created: QuizDraftRow = {
                id: draftId,
                owner_username: user.username,
                quiz_id: quizId,
                draft_json: JSON.stringify(normalizedDraft),
                revision,
                created_at: now,
                updated_at: now,
                expires_at: null,
            };
            return jsonResponse(mapDraftRow(created));
        }

        if (!requireOwnership(user, current.owner_username)) {
            return errorResponse('Forbidden: You do not own this draft', 403);
        }
        if (parsed.value.expectedRevision !== Number(current.revision)) {
            return conflictResponse(current);
        }

        const revision = Number(current.revision) + 1;
        const normalizedDraft: ManualQuizDraftPayload = {
            ...parsed.value.draft,
            draftId,
            quizId: parsed.value.draft.quizId || current.quiz_id || undefined,
            ownerUsername: current.owner_username,
            revision,
            updatedAt: now,
        };
        const quizId = normalizedDraft.quizId || null;
        const result = await env.DB.prepare(`
            UPDATE quiz_drafts
            SET quiz_id = ?, draft_json = ?, revision = ?, updated_at = ?, expires_at = ?
            WHERE id = ? AND revision = ?
        `).bind(
            quizId,
            JSON.stringify(normalizedDraft),
            revision,
            now,
            current.expires_at,
            draftId,
            current.revision,
        ).run();

        if (Number(result.meta?.changes || 0) !== 1) {
            const latest = await selectDraft(env.DB, draftId);
            if (latest) return conflictResponse(latest);
            return jsonResponse({
                status: 'error',
                code: 'DRAFT_CONFLICT',
                message: 'Bản nháp trên máy chủ đã thay đổi hoặc bị xóa.',
                current: null,
            }, 409);
        }

        const updated: QuizDraftRow = {
            ...current,
            quiz_id: quizId,
            draft_json: JSON.stringify(normalizedDraft),
            revision,
            updated_at: now,
        };
        return jsonResponse(mapDraftRow(updated));
    }

    if (method === 'DELETE') {
        const current = await selectDraft(env.DB, draftId);
        if (!current) return errorResponse('Không tìm thấy bản nháp.', 404);
        if (!requireOwnership(user, current.owner_username)) {
            return errorResponse('Forbidden: You do not own this draft', 403);
        }
        await env.DB.prepare('DELETE FROM quiz_drafts WHERE id = ?').bind(draftId).run();
        return jsonResponse({ status: 'success', id: draftId });
    }

    return errorResponse(`Method not allowed: ${method}`, 405);
}
