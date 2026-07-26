import type { Env } from '../types';
import { verifyJWTMiddleware, requireAdmin } from '../middleware/jwtAuth';
import { hashSHA256, parseBody } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';
import {
    auditPersistedQuestionRow,
    CURRENT_MATH_FORMAT_VERSION,
    PERSISTED_MATH_COLUMNS,
    snapshotPersistedMath,
    type PersistedQuestionRow,
} from '../services/questionMath';

type AuditRow = PersistedQuestionRow & { quiz_title?: string };

type RepairRow = {
    id: string;
    batch_id: string;
    question_id: string;
    quiz_id: string;
    before_payload: string;
    after_payload: string;
    previous_version: number;
    new_version: number;
    repaired_by: string;
    created_at: string;
    rolled_back_at?: string | null;
    rolled_back_by?: string | null;
};

export interface MathTelemetryPayload {
    quizId: string;
    questionId: string;
    questionType: string;
    errorCode: string;
    route: string;
    mathFormatVersion: number;
}

const boundedString = (value: unknown, maxLength: number): string =>
    typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeRoute = (value: unknown): string => {
    const route = boundedString(value, 120);
    if (!route.startsWith('/')) return '';
    return route.split(/[?#]/, 1)[0];
};

/** Strict privacy boundary: unknown fields (formula, message, stack, student data) are discarded. */
export const sanitizeMathTelemetryPayload = (input: unknown): MathTelemetryPayload | null => {
    if (!input || typeof input !== 'object') return null;
    const source = input as Record<string, unknown>;
    const errorCode = boundedString(source.errorCode, 64).toUpperCase();
    if (!/^[A-Z0-9_-]{2,64}$/.test(errorCode)) return null;

    const rawVersion = Number(source.mathFormatVersion);
    const mathFormatVersion = Number.isSafeInteger(rawVersion) && rawVersion >= 0 && rawVersion <= 100
        ? rawVersion
        : 0;

    return {
        quizId: boundedString(source.quizId, 100),
        questionId: boundedString(source.questionId, 100),
        questionType: boundedString(source.questionType, 40).toUpperCase(),
        errorCode,
        route: normalizeRoute(source.route),
        mathFormatVersion,
    };
};

const requireAdminUser = async (request: Request, env: Env) => {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    if (!requireAdmin(authResult.user)) return errorResponse('Forbidden: admin role required', 403);
    return authResult.user;
};

const getAuditRows = async (db: D1Database): Promise<AuditRow[]> => {
    const rows = await db.prepare(`
        SELECT q.*, z.title AS quiz_title
        FROM questions q
        LEFT JOIN quizzes z ON z.id = q.quiz_id
        ORDER BY z.title COLLATE NOCASE, q.id
    `).all<AuditRow>();
    return rows.results;
};

const updateQuestionStatement = (
    db: D1Database,
    questionId: string,
    payload: Record<string, unknown>,
): D1PreparedStatement => db.prepare(`
    UPDATE questions SET
        question = ?, options = ?, correct_answer = ?, items = ?, text_field = ?,
        blanks = ?, distractors = ?, sentence = ?, words = ?, correct_word_indexes = ?,
        math_format_version = ?
    WHERE id = ?
`).bind(
    ...PERSISTED_MATH_COLUMNS.map((column) => String(payload[column] ?? '')),
    Number(payload.math_format_version || 1),
    questionId,
);

const issueDto = (row: AuditRow) => {
    const audit = auditPersistedQuestionRow(row);
    return {
        questionId: row.id,
        quizId: row.quiz_id,
        quizTitle: String(row.quiz_title || ''),
        questionType: row.type,
        currentVersion: audit.currentVersion,
        targetVersion: CURRENT_MATH_FORMAT_VERSION,
        needsUpgrade: audit.needsUpgrade,
        changedFields: audit.changedFields,
        currentIssues: audit.currentIssues.map((issue) => ({
            field: issue.field,
            code: issue.code,
            message: issue.message,
            index: issue.index,
        })),
        remainingIssues: audit.remainingIssues.map((issue) => ({
            field: issue.field,
            code: issue.code,
            message: issue.message,
            index: issue.index,
        })),
        previewBefore: audit.previewBefore,
        previewAfter: audit.previewAfter,
    };
};

const listAuditIssues = async (request: Request, env: Env): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') || 250);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(1000, requestedLimit)) : 250;
    const rows = await getAuditRows(env.DB);
    const allIssues = rows
        .map(issueDto)
        // Monitoring mode intentionally ignores version-only legacy rows.
        // A row appears only when its persisted math syntax currently has a real issue.
        .filter((item) => item.currentIssues.length > 0);

    return jsonResponse({
        status: 'success',
        data: allIssues.slice(0, limit),
        summary: {
            scanned: rows.length,
            affected: allIssues.length,
            autoFixable: allIssues.filter((item) => item.remainingIssues.length === 0).length,
            blocked: allIssues.filter((item) => item.remainingIssues.length > 0).length,
            currentVersion: CURRENT_MATH_FORMAT_VERSION,
        },
    });
};

const applyAuditRepairs = async (request: Request, env: Env): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    const body = await parseBody(request);
    const questionIds: string[] = Array.isArray(body?.questionIds)
        ? Array.from(new Set<string>(
            body.questionIds
                .map((value: unknown) => boundedString(value, 100))
                .filter((value: string) => value.length > 0),
        )).slice(0, 100)
        : [];
    if (questionIds.length === 0) return errorResponse('questionIds is required', 400);

    const batchId = `math-repair-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    const skipped: Array<{ questionId: string; reason: string }> = [];

    for (const questionId of questionIds) {
        const row = await env.DB.prepare('SELECT * FROM questions WHERE id = ?')
            .bind(questionId)
            .first<AuditRow>();
        if (!row) {
            skipped.push({ questionId, reason: 'not-found' });
            continue;
        }

        const audit = auditPersistedQuestionRow(row);
        if (audit.remainingIssues.length > 0) {
            skipped.push({ questionId, reason: 'requires-manual-edit' });
            continue;
        }
        if (audit.changedFields.length === 0 && !audit.needsUpgrade) {
            skipped.push({ questionId, reason: 'already-current' });
            continue;
        }

        const beforePayload = JSON.stringify(snapshotPersistedMath(row));
        const afterPayloadObject = snapshotPersistedMath(audit.normalized);
        const afterPayload = JSON.stringify(afterPayloadObject);
        const repairId = `repair-${crypto.randomUUID()}`;

        statements.push(env.DB.prepare(`
            INSERT INTO question_math_repairs (
                id, batch_id, question_id, quiz_id, before_payload, after_payload,
                previous_version, new_version, repaired_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            repairId,
            batchId,
            row.id,
            row.quiz_id,
            beforePayload,
            afterPayload,
            audit.currentVersion,
            CURRENT_MATH_FORMAT_VERSION,
            auth.username,
            now,
        ));
        statements.push(updateQuestionStatement(env.DB, row.id, afterPayloadObject));
    }

    if (statements.length > 0) await env.DB.batch(statements);

    return jsonResponse({
        status: 'success',
        data: {
            batchId: statements.length > 0 ? batchId : null,
            repaired: statements.length / 2,
            skipped,
        },
    });
};

const listRepairBatches = async (request: Request, env: Env): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    const rows = await env.DB.prepare(`
        SELECT
            batch_id,
            MIN(created_at) AS created_at,
            MIN(repaired_by) AS repaired_by,
            COUNT(*) AS total,
            SUM(CASE WHEN rolled_back_at IS NOT NULL THEN 1 ELSE 0 END) AS rolled_back
        FROM question_math_repairs
        GROUP BY batch_id
        ORDER BY created_at DESC
        LIMIT 50
    `).all();
    return jsonResponse({ status: 'success', data: rows.results });
};

const rollbackRepairBatch = async (
    request: Request,
    env: Env,
    batchId: string,
): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    const repairs = await env.DB.prepare(`
        SELECT * FROM question_math_repairs
        WHERE batch_id = ? AND rolled_back_at IS NULL
        ORDER BY created_at DESC
    `).bind(batchId).all<RepairRow>();
    if (repairs.results.length === 0) return errorResponse('Repair batch not found or already rolled back', 404);

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    const conflicts: Array<{ questionId: string; reason: string }> = [];

    for (const repair of repairs.results) {
        const current = await env.DB.prepare('SELECT * FROM questions WHERE id = ?')
            .bind(repair.question_id)
            .first<PersistedQuestionRow>();
        if (!current) {
            conflicts.push({ questionId: repair.question_id, reason: 'question-missing' });
            continue;
        }

        const currentPayload = JSON.stringify(snapshotPersistedMath(current));
        if (currentPayload !== repair.after_payload) {
            conflicts.push({ questionId: repair.question_id, reason: 'question-changed-after-repair' });
            continue;
        }

        let before: Record<string, unknown>;
        try {
            before = JSON.parse(repair.before_payload) as Record<string, unknown>;
        } catch {
            conflicts.push({ questionId: repair.question_id, reason: 'invalid-snapshot' });
            continue;
        }

        statements.push(updateQuestionStatement(env.DB, repair.question_id, before));
        statements.push(env.DB.prepare(`
            UPDATE question_math_repairs
            SET rolled_back_at = ?, rolled_back_by = ?
            WHERE id = ? AND rolled_back_at IS NULL
        `).bind(now, auth.username, repair.id));
    }

    if (statements.length > 0) await env.DB.batch(statements);
    return jsonResponse({
        status: conflicts.length > 0 ? 'partial' : 'success',
        data: {
            batchId,
            rolledBack: statements.length / 2,
            conflicts,
        },
    });
};

const mathRepairDisabled = async (request: Request, env: Env): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    return jsonResponse({
        status: 'error',
        code: 'MATH_REPAIR_DISABLED',
        message: 'Chế độ sửa hàng loạt công thức đã được vô hiệu hóa. Hãy sửa câu hỏi trong màn Đề kiểm tra.',
    }, 410);
};

const ingestMathTelemetry = async (request: Request, env: Env): Promise<Response> => {
    const body = await parseBody(request);
    const payload = sanitizeMathTelemetryPayload(body);
    if (!payload) return errorResponse('Invalid telemetry payload', 400);

    const now = new Date().toISOString();
    const dayBucket = now.slice(0, 10);
    const fingerprint = await hashSHA256(JSON.stringify([
        dayBucket,
        payload.quizId,
        payload.questionId,
        payload.questionType,
        payload.errorCode,
        payload.route,
        payload.mathFormatVersion,
    ]));

    await env.DB.prepare(`
        INSERT INTO math_render_events (
            fingerprint, quiz_id, question_id, question_type, error_code, route,
            math_format_version, count, first_seen_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(fingerprint) DO UPDATE SET
            count = math_render_events.count + 1,
            last_seen_at = excluded.last_seen_at
    `).bind(
        fingerprint,
        payload.quizId,
        payload.questionId,
        payload.questionType,
        payload.errorCode,
        payload.route,
        payload.mathFormatVersion,
        now,
        now,
    ).run();

    return jsonResponse({ status: 'success' }, 202);
};

const listMathTelemetry = async (request: Request, env: Env): Promise<Response> => {
    const auth = await requireAdminUser(request, env);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get('days') || 7);
    const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(30, requestedDays)) : 7;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await env.DB.prepare(`
        SELECT fingerprint, quiz_id, question_id, question_type, error_code, route,
               math_format_version, count, first_seen_at, last_seen_at
        FROM math_render_events
        WHERE last_seen_at >= ?
        ORDER BY last_seen_at DESC
        LIMIT 500
    `).bind(since).all();

    return jsonResponse({
        status: 'success',
        data: rows.results,
        summary: {
            events: rows.results.length,
            occurrences: rows.results.reduce((total, row: any) => total + Number(row.count || 0), 0),
            days,
        },
    });
};

export async function handleMathObservabilityRoutes(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (path === '/api/math/telemetry' && method === 'POST') {
        return ingestMathTelemetry(request, env);
    }
    if (path === '/api/admin/math-audit/issues' && method === 'GET') {
        return listAuditIssues(request, env);
    }
    if (path === '/api/admin/math-audit/apply' && method === 'POST') {
        return mathRepairDisabled(request, env);
    }
    if (path === '/api/admin/math-audit/batches' && method === 'GET') {
        return listRepairBatches(request, env);
    }
    const rollbackMatch = path.match(/^\/api\/admin\/math-audit\/batches\/([^/]+)\/rollback$/);
    if (rollbackMatch && method === 'POST') {
        return mathRepairDisabled(request, env);
    }
    if (path === '/api/admin/math-telemetry' && method === 'GET') {
        return listMathTelemetry(request, env);
    }
    return null;
}
