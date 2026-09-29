import { requireTeacherForClass } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { getCurrentDateKey } from '../../gameLoop/dateKeys';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

const ATTENDANCE_PATH = /^\/api\/classes\/([^/]+)\/attendance(?:\/questions(?:\/([^/]+))?)?$/;

const parseStoredJson = <T>(value: unknown, fallback: T): T => {
    try {
        return JSON.parse(String(value ?? '')) as T;
    } catch {
        return fallback;
    }
};

const serializeRichText = (value: unknown): string | null => {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
};

const mapQuestion = (row: any) => ({
    id: String(row.id),
    subject: String(row.subject || ''),
    question: String(row.question_text || ''),
    questionRichText: row.question_rich_text
        ? parseStoredJson(row.question_rich_text, row.question_rich_text)
        : undefined,
    options: parseStoredJson<string[]>(row.options_json, []),
    correctAnswer: String(row.correct_answer || '').toUpperCase(),
    image: String(row.image_url || ''),
    imageAlt: String(row.image_alt || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
});

const normalizeQuestion = (body: any, current?: any) => {
    const question = String(body.question ?? current?.question_text ?? '').trim();
    const subject = String(body.subject ?? current?.subject ?? '').trim().slice(0, 80);
    const optionsSource = body.options ?? parseStoredJson<string[]>(current?.options_json, []);
    const options = Array.isArray(optionsSource)
        ? optionsSource.map((option) => String(option ?? '').trim())
        : [];
    const correctAnswer = String(body.correctAnswer ?? current?.correct_answer ?? '').trim().toUpperCase();
    const questionRichText = body.questionRichText === undefined
        ? (current?.question_rich_text ?? null)
        : serializeRichText(body.questionRichText);
    const image = String(body.image ?? current?.image_url ?? '').trim();
    const imageAlt = String(body.imageAlt ?? current?.image_alt ?? '').trim();

    if (!question) return { error: 'Nội dung câu hỏi không được để trống.' } as const;
    if (options.length !== 4 || options.some((option) => !option)) {
        return { error: 'Câu hỏi điểm danh cần đủ 4 đáp án A, B, C, D.' } as const;
    }
    if (!/^[A-D]$/.test(correctAnswer)) {
        return { error: 'Đáp án đúng phải là A, B, C hoặc D.' } as const;
    }

    return {
        value: {
            subject,
            question,
            questionRichText,
            options,
            correctAnswer,
            image,
            imageAlt,
        },
    } as const;
};

const loadSummary = async (db: D1Database, classId: string) => {
    const [settings, questions, totalStudents, claimedToday] = await Promise.all([
        db.prepare(`
            SELECT is_enabled
            FROM class_attendance_settings
            WHERE class_id = ?
            LIMIT 1
        `).bind(classId).first<any>(),
        db.prepare(`
            SELECT id, subject, question_text, question_rich_text, options_json, correct_answer,
                   image_url, image_alt, created_at, updated_at
            FROM class_attendance_questions
            WHERE class_id = ? AND is_active = 1
            ORDER BY datetime(created_at) ASC, id ASC
        `).bind(classId).all<any>(),
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM students
            WHERE class_id = ? AND COALESCE(archived_at, '') = ''
        `).bind(classId).first<any>(),
        db.prepare(`
            SELECT COUNT(DISTINCT ac.username) AS count
            FROM attendance_claims ac
            INNER JOIN students s ON s.username = ac.username
            WHERE s.class_id = ?
              AND COALESCE(s.archived_at, '') = ''
              AND ac.claim_date = ?
        `).bind(classId, getCurrentDateKey()).first<any>(),
    ]);

    return {
        enabled: Number(settings?.is_enabled) === 1,
        questions: (questions.results || []).map(mapQuestion),
        stats: {
            totalStudents: Number(totalStudents?.count) || 0,
            claimedToday: Number(claimedToday?.count) || 0,
        },
    };
};

export async function handleClassAttendanceRoute(
    context: ClassroomRouteContext,
): Promise<Response | null> {
    const match = context.path.match(ATTENDANCE_PATH);
    if (!match) return null;

    const classId = decodeURIComponent(match[1]);
    const questionId = match[2] ? decodeURIComponent(match[2]) : '';
    const ownershipError = await requireTeacherForClass(context.db, context.user, classId);
    if (ownershipError) return ownershipError;

    if (context.method === 'GET' && !questionId && !context.path.includes('/questions')) {
        return jsonResponse({ status: 'success', data: await loadSummary(context.db, classId) });
    }

    if (context.method === 'PATCH' && !questionId && !context.path.includes('/questions')) {
        const body = await parseBody(context.request);
        if (!body || typeof body.enabled !== 'boolean') {
            return errorResponse('Thiếu trạng thái bật/tắt điểm danh.', 400);
        }

        if (body.enabled) {
            const count = await context.db.prepare(`
                SELECT COUNT(*) AS count
                FROM class_attendance_questions
                WHERE class_id = ? AND is_active = 1
            `).bind(classId).first<any>();
            if ((Number(count?.count) || 0) < 2) {
                return errorResponse('Cần ít nhất 2 câu hỏi để bật điểm danh.', 409);
            }
        }

        await context.db.prepare(`
            INSERT INTO class_attendance_settings (class_id, is_enabled, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(class_id) DO UPDATE SET
                is_enabled = excluded.is_enabled,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at
        `).bind(
            classId,
            body.enabled ? 1 : 0,
            context.user.username,
            context.nowIso,
            context.nowIso,
        ).run();

        return jsonResponse({ status: 'success', data: await loadSummary(context.db, classId) });
    }

    if (context.path.endsWith('/attendance/questions') && context.method === 'POST') {
        const body = await parseBody(context.request);
        if (!body) return errorResponse('Dữ liệu câu hỏi không hợp lệ.', 400);
        const normalized = normalizeQuestion(body);
        if ('error' in normalized) return errorResponse(normalized.error || 'Dữ liệu câu hỏi không hợp lệ.', 400);

        const id = generateId('attq');
        const value = normalized.value;
        await context.db.prepare(`
            INSERT INTO class_attendance_questions (
                id, class_id, subject, question_text, question_rich_text, options_json,
                correct_answer, image_url, image_alt, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).bind(
            id,
            classId,
            value.subject,
            value.question,
            value.questionRichText,
            JSON.stringify(value.options),
            value.correctAnswer,
            value.image || null,
            value.imageAlt || null,
            context.nowIso,
            context.nowIso,
        ).run();

        const row = await context.db.prepare(`
            SELECT id, subject, question_text, question_rich_text, options_json, correct_answer,
                   image_url, image_alt, created_at, updated_at
            FROM class_attendance_questions
            WHERE id = ? AND class_id = ?
            LIMIT 1
        `).bind(id, classId).first<any>();
        return jsonResponse({ status: 'success', data: mapQuestion(row) });
    }

    if (questionId && context.method === 'PATCH') {
        const current = await context.db.prepare(`
            SELECT *
            FROM class_attendance_questions
            WHERE id = ? AND class_id = ? AND is_active = 1
            LIMIT 1
        `).bind(questionId, classId).first<any>();
        if (!current) return errorResponse('Không tìm thấy câu hỏi điểm danh.', 404);

        const body = await parseBody(context.request);
        if (!body) return errorResponse('Dữ liệu câu hỏi không hợp lệ.', 400);
        const normalized = normalizeQuestion(body, current);
        if ('error' in normalized) return errorResponse(normalized.error || 'Dữ liệu câu hỏi không hợp lệ.', 400);
        const value = normalized.value;

        await context.db.prepare(`
            UPDATE class_attendance_questions
            SET subject = ?, question_text = ?, question_rich_text = ?, options_json = ?,
                correct_answer = ?, image_url = ?, image_alt = ?, updated_at = ?
            WHERE id = ? AND class_id = ?
        `).bind(
            value.subject,
            value.question,
            value.questionRichText,
            JSON.stringify(value.options),
            value.correctAnswer,
            value.image || null,
            value.imageAlt || null,
            context.nowIso,
            questionId,
            classId,
        ).run();

        const row = await context.db.prepare(`
            SELECT id, subject, question_text, question_rich_text, options_json, correct_answer,
                   image_url, image_alt, created_at, updated_at
            FROM class_attendance_questions
            WHERE id = ? AND class_id = ?
            LIMIT 1
        `).bind(questionId, classId).first<any>();
        return jsonResponse({ status: 'success', data: mapQuestion(row) });
    }

    if (questionId && context.method === 'DELETE') {
        const existing = await context.db.prepare(`
            SELECT id
            FROM class_attendance_questions
            WHERE id = ? AND class_id = ? AND is_active = 1
            LIMIT 1
        `).bind(questionId, classId).first<any>();
        if (!existing) return errorResponse('Không tìm thấy câu hỏi điểm danh.', 404);

        await context.db.prepare(`
            UPDATE class_attendance_questions
            SET is_active = 0, updated_at = ?
            WHERE id = ? AND class_id = ?
        `).bind(context.nowIso, questionId, classId).run();

        const count = await context.db.prepare(`
            SELECT COUNT(*) AS count
            FROM class_attendance_questions
            WHERE class_id = ? AND is_active = 1
        `).bind(classId).first<any>();
        if ((Number(count?.count) || 0) < 2) {
            await context.db.prepare(`
                UPDATE class_attendance_settings
                SET is_enabled = 0, updated_by = ?, updated_at = ?
                WHERE class_id = ?
            `).bind(context.user.username, context.nowIso, classId).run();
        }

        return jsonResponse({ status: 'success', data: await loadSummary(context.db, classId) });
    }

    return null;
}
