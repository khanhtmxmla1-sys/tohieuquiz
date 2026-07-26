import { Env } from '../types';
import { verifyJWTMiddleware, isStudent, requireTeacher } from '../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../utils/response';
import { JWTPayload } from '../utils/jwt';
import {
    createParentNotification,
    fanOutParentNotificationToClass,
} from '../parentPortal/notificationService';
import { createNotification } from '../services/notificationWriter';

type AssignmentRow = Record<string, any>;

const HOMEWORK_MEDIA_HOSTS = new Set(['res.cloudinary.com']);
const ASSIGNMENT_STATUSES = new Set(['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED']);

function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string') return (value as T) ?? fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
}

function effectiveStatus(row: AssignmentRow, now = Date.now()): string {
    if (row.status === 'ARCHIVED' || row.archived_at) return 'ARCHIVED';
    if (row.status === 'DRAFT') return 'DRAFT';
    if (row.status === 'CLOSED') return 'CLOSED';
    const deadline = Date.parse(String(row.deadline || ''));
    return Number.isFinite(deadline) && deadline <= now ? 'EXPIRED' : 'OPEN';
}

function mapAssignment(row: AssignmentRow) {
    return {
        ...row,
        class: { id: row.class_id, name: row.class_name || row.class_id },
        totalStudents: Number(row.total_students || 0),
        submittedCount: Number(row.submitted_count || 0),
        gradedCount: Number(row.graded_count || 0),
        pendingCount: Math.max(0, Number(row.submitted_count || 0) - Number(row.graded_count || 0)),
        effectiveStatus: effectiveStatus(row),
        maxAttempts: Number(row.max_attempts || 1),
        rubric: parseJson(row.rubric_json, []),
    };
}

function mapSubmission(row: Record<string, any>): any {
    return {
        ...row,
        file_urls: parseJson<string[]>(row.file_urls, []),
        analyticsData: parseJson<any[]>(row.analytics_json, []),
        gradingBreakdown: parseJson<any[]>(row.grading_breakdown_json, []),
        attemptNo: Number(row.attempt_no || 1),
    };
}

async function readBody(request: Request): Promise<Record<string, any>> {
    try { return await request.json() as Record<string, any>; } catch { return {}; }
}

async function getClass(db: D1Database, classId: string) {
    return db.prepare('SELECT id, name, teacher_username FROM classes WHERE id = ?').bind(classId).first<any>();
}

async function getAssignment(db: D1Database, assignmentId: string) {
    return db.prepare(`
        SELECT ha.*, c.name AS class_name, c.teacher_username
        FROM hw_assignments ha
        JOIN classes c ON c.id = ha.class_id
        WHERE ha.id = ?
    `).bind(assignmentId).first<any>();
}

function teacherOwnsClass(user: JWTPayload, classroom: any): boolean {
    return user.role === 'admin' || (user.role === 'teacher' && user.username === classroom?.teacher_username);
}

function teacherOwnsAssignment(user: JWTPayload, assignment: any): boolean {
    return user.role === 'admin' || (user.role === 'teacher' && user.username === assignment?.teacher_username);
}

function validateMediaUrls(urls: unknown): string[] | null {
    if (!Array.isArray(urls) || urls.length < 1 || urls.length > 8) return null;
    const normalized: string[] = [];
    for (const raw of urls) {
        try {
            const url = new URL(String(raw));
            if (url.protocol !== 'https:' || !HOMEWORK_MEDIA_HOSTS.has(url.hostname)) return null;
            normalized.push(url.toString());
        } catch { return null; }
    }
    return normalized;
}

async function listAssignments(db: D1Database, user: JWTPayload, url: URL): Promise<Response> {
    const params: unknown[] = [];
    let where = "WHERE COALESCE(ha.archived_at, '') = ''";
    if (isStudent(user)) {
        if (!user.classId) return errorResponse('Student class is missing', 403);
        where += " AND ha.class_id = ? AND ha.status <> 'DRAFT'";
        params.push(user.classId);
    } else if (user.role === 'teacher') {
        where += ' AND c.teacher_username = ?';
        params.push(user.username);
        const classId = url.searchParams.get('classId');
        if (classId) { where += ' AND ha.class_id = ?'; params.push(classId); }
    } else {
        const classId = url.searchParams.get('classId');
        if (classId) { where += ' AND ha.class_id = ?'; params.push(classId); }
    }

    const rows = await db.prepare(`
        SELECT ha.*, c.name AS class_name,
          (SELECT COUNT(*) FROM students s WHERE s.class_id = ha.class_id AND COALESCE(s.archived_at, '') = '') AS total_students,
          (SELECT COUNT(DISTINCT hs.student_id) FROM hw_submissions hs WHERE hs.assignment_id = ha.id) AS submitted_count,
          (SELECT COUNT(DISTINCT hs.student_id) FROM hw_submissions hs WHERE hs.assignment_id = ha.id AND hs.published_at IS NOT NULL) AS graded_count
        FROM hw_assignments ha
        JOIN classes c ON c.id = ha.class_id
        ${where}
        ORDER BY datetime(ha.deadline) ASC, datetime(ha.created_at) DESC
    `).bind(...params).all<any>();
    return jsonResponse({ status: 'success', data: rows.results.map(mapAssignment) });
}

async function createAssignment(db: D1Database, user: JWTPayload, body: Record<string, any>): Promise<Response> {
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);
    const classId = String(body.classId || body.class_id || '').trim();
    const classroom = await getClass(db, classId);
    if (!classroom || !teacherOwnsClass(user, classroom)) return errorResponse('Forbidden: Class access denied', 403);

    const title = String(body.title || '').trim();
    const deadline = String(body.deadline || '').trim();
    const deadlineMs = Date.parse(deadline);
    if (!title || !Number.isFinite(deadlineMs)) return errorResponse('Title and valid deadline are required', 400);
    const status = ASSIGNMENT_STATUSES.has(body.status) ? body.status : 'OPEN';
    const maxAttempts = Math.min(10, Math.max(1, Number(body.maxAttempts || body.max_attempts || 1)));
    const id = `hw-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const rubric = Array.isArray(body.rubric) ? body.rubric : parseJson(body.rubric_json, []);
    await db.prepare(`
        INSERT INTO hw_assignments (
          id, title, description, subject, deadline, class_id, teacher_id, file_url, ai_content,
          status, max_attempts, published_at, updated_at, archived_at, source_ocr_text, rubric_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).bind(
        id, title, String(body.description || ''), String(body.subject || ''), new Date(deadlineMs).toISOString(),
        classId, user.username, String(body.fileUrl || body.file_url || ''), String(body.aiContent || body.ai_content || ''),
        status, maxAttempts, status === 'OPEN' ? now : null, now,
        String(body.sourceOcrText || body.source_ocr_text || body.aiContent || body.ai_content || ''), JSON.stringify(rubric), now,
    ).run();
    if (status === 'OPEN') {
        try {
            await fanOutParentNotificationToClass(db, {
                classId,
                kind: 'homework_assigned',
                sourceType: 'homework',
                sourceId: `${id}:published`,
                title: 'Có bài tập mới',
                body: `${title} – hạn nộp ${new Date(deadlineMs).toLocaleString('vi-VN')}.`,
                payload: { assignmentId: id, subject: String(body.subject || ''), deadline: new Date(deadlineMs).toISOString() },
                publishedAt: now,
                createdBy: user.username,
            });
        } catch (error) {
            console.error('[ParentNotification] homework assignment notification failed', error);
        }
    }
    return jsonResponse({ status: 'success', data: { id } }, 201);
}

async function updateAssignment(db: D1Database, user: JWTPayload, assignmentId: string, body: Record<string, any>): Promise<Response> {
    const current = await getAssignment(db, assignmentId);
    if (!current) return errorResponse('Assignment not found', 404);
    if (!teacherOwnsAssignment(user, current)) return errorResponse('Forbidden', 403);
    const targetClassId = String(body.classId || body.class_id || current.class_id);
    const classroom = await getClass(db, targetClassId);
    if (!classroom || !teacherOwnsClass(user, classroom)) return errorResponse('Forbidden: Class access denied', 403);
    const deadlineRaw = String(body.deadline || current.deadline);
    const deadlineMs = Date.parse(deadlineRaw);
    if (!Number.isFinite(deadlineMs)) return errorResponse('Invalid deadline', 400);
    const status = ASSIGNMENT_STATUSES.has(body.status) ? body.status : current.status;
    const maxAttempts = Math.min(10, Math.max(1, Number(body.maxAttempts || body.max_attempts || current.max_attempts || 1)));
    const rubric = body.rubric !== undefined ? body.rubric : parseJson(current.rubric_json, []);
    const now = new Date().toISOString();
    const title = String(body.title ?? current.title);
    const subject = String(body.subject ?? current.subject);
    await db.prepare(`
      UPDATE hw_assignments SET title=?, description=?, subject=?, deadline=?, class_id=?, file_url=?,
        status=?, max_attempts=?, published_at=?, updated_at=?, source_ocr_text=?, rubric_json=? WHERE id=?
    `).bind(
        title, String(body.description ?? current.description), subject,
        new Date(deadlineMs).toISOString(), targetClassId, String(body.fileUrl || body.file_url || current.file_url), status,
        maxAttempts, status === 'OPEN' ? (current.published_at || now) : current.published_at,
        now, String(body.sourceOcrText ?? body.source_ocr_text ?? current.source_ocr_text),
        JSON.stringify(Array.isArray(rubric) ? rubric : []), assignmentId,
    ).run();
    if (String(current.status) !== 'OPEN' && status === 'OPEN') {
        try {
            await fanOutParentNotificationToClass(db, {
                classId: targetClassId,
                kind: 'homework_assigned',
                sourceType: 'homework',
                sourceId: `${assignmentId}:published`,
                title: 'Có bài tập mới',
                body: `${title} – hạn nộp ${new Date(deadlineMs).toLocaleString('vi-VN')}.`,
                payload: { assignmentId, subject, deadline: new Date(deadlineMs).toISOString() },
                publishedAt: now,
                createdBy: user.username,
            });
        } catch (error) {
            console.error('[ParentNotification] homework publish notification failed', error);
        }
    }
    return jsonResponse({ status: 'success', data: { id: assignmentId } });
}

async function archiveAssignment(db: D1Database, user: JWTPayload, assignmentId: string): Promise<Response> {
    const assignment = await getAssignment(db, assignmentId);
    if (!assignment) return errorResponse('Assignment not found', 404);
    if (!teacherOwnsAssignment(user, assignment)) return errorResponse('Forbidden', 403);
    const now = new Date().toISOString();
    await db.prepare("UPDATE hw_assignments SET status='ARCHIVED', archived_at=?, updated_at=? WHERE id=?")
        .bind(now, now, assignmentId).run();
    return jsonResponse({ status: 'success', data: { id: assignmentId, status: 'ARCHIVED' } });
}

async function getSubmissions(db: D1Database, user: JWTPayload, assignmentId: string): Promise<Response> {
    const assignment = await getAssignment(db, assignmentId);
    if (!assignment) return errorResponse('Assignment not found', 404);
    if (isStudent(user)) {
        if (user.classId !== assignment.class_id || !user.id) return errorResponse('Forbidden', 403);
        const rows = await db.prepare('SELECT * FROM hw_submissions WHERE assignment_id=? AND student_id=? ORDER BY attempt_no DESC')
            .bind(assignmentId, user.id).all<any>();
        return jsonResponse({ status: 'success', data: rows.results.map(mapSubmission) });
    }
    if (!teacherOwnsAssignment(user, assignment)) return errorResponse('Forbidden', 403);
    const rows = await db.prepare('SELECT * FROM hw_submissions WHERE assignment_id=? ORDER BY student_name COLLATE NOCASE, attempt_no DESC')
        .bind(assignmentId).all<any>();
    return jsonResponse({ status: 'success', data: rows.results.map(mapSubmission) });
}

async function getMyLatestSubmissions(db: D1Database, user: JWTPayload): Promise<Response> {
    if (!isStudent(user) || !user.id || !user.classId) return errorResponse('Forbidden: Student access required', 403);
    const rows = await db.prepare(`
      WITH ranked AS (
        SELECT hs.*, ROW_NUMBER() OVER (PARTITION BY hs.assignment_id ORDER BY hs.attempt_no DESC) AS rank
        FROM hw_submissions hs JOIN hw_assignments ha ON ha.id=hs.assignment_id
        WHERE hs.student_id=? AND ha.class_id=? AND COALESCE(ha.archived_at, '')=''
      ) SELECT * FROM ranked WHERE rank=1 ORDER BY datetime(submitted_at) DESC
    `).bind(user.id, user.classId).all<any>();
    return jsonResponse({ status: 'success', data: rows.results.map(mapSubmission) });
}

async function submitHomework(db: D1Database, user: JWTPayload, assignmentId: string, body: Record<string, any>): Promise<Response> {
    if (!isStudent(user) || !user.id || !user.classId) return errorResponse('Forbidden: Student access required', 403);
    const assignment = await getAssignment(db, assignmentId);
    if (!assignment || assignment.class_id !== user.classId) return errorResponse('Forbidden: Assignment access denied', 403);
    if (effectiveStatus(assignment) !== 'OPEN') return errorResponse('Assignment is closed or expired', 409);
    const student = await db.prepare('SELECT id, full_name, class_id FROM students WHERE id=?').bind(user.id).first<any>();
    if (!student || student.class_id !== assignment.class_id) return errorResponse('Forbidden: Student class mismatch', 403);
    const urls = validateMediaUrls(body.fileUrls || body.file_urls);
    if (!urls) return errorResponse('Provide 1-8 valid homework images', 400);
    const idempotencyKey = String(body.idempotencyKey || body.idempotency_key || '').trim();
    if (!idempotencyKey || idempotencyKey.length > 128) return errorResponse('Valid idempotencyKey is required', 400);
    const existing = await db.prepare('SELECT * FROM hw_submissions WHERE student_id=? AND idempotency_key=?')
        .bind(user.id, idempotencyKey).first<any>();
    if (existing) return jsonResponse({ status: 'success', data: mapSubmission(existing), idempotent: true });
    const countRow = await db.prepare('SELECT COUNT(*) AS count FROM hw_submissions WHERE assignment_id=? AND student_id=?')
        .bind(assignmentId, user.id).first<any>();
    const attemptNo = Number(countRow?.count || 0) + 1;
    if (attemptNo > Number(assignment.max_attempts || 1)) return errorResponse('Maximum submission attempts reached', 409);
    const id = `sub-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO hw_submissions (
        id, assignment_id, student_id, student_name, status, file_urls, student_note, teacher_feedback,
        ai_evaluation, score, submitted_at, analytics_json, attempt_no, idempotency_key, ai_feedback, grading_breakdown_json
      ) VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?, '', '', 0, ?, '[]', ?, ?, '', '[]')
    `).bind(id, assignmentId, user.id, student.full_name || user.fullName || user.username, JSON.stringify(urls),
        String(body.studentNote || body.student_note || ''), now, attemptNo, idempotencyKey).run();
    try {
        await createNotification(db, {
            userId: String(assignment.teacher_username),
            userRole: 'teacher',
            type: 'assignment_submitted',
            priority: 'IMPORTANT',
            title: 'Có học sinh vừa nộp bài',
            body: `${student.full_name || user.fullName || user.username} đã nộp “${assignment.title || 'Bài tập'}”.`,
            actionUrl: `/teacher/homework?assignment=${encodeURIComponent(assignmentId)}`,
            data: { assignment_id: assignmentId, submission_id: id, student_id: user.id },
            sourceType: 'homework_submission',
            sourceId: id,
            createdAt: now,
        });
    } catch (error) {
        console.error('[NotificationWriter] assignment_submitted failed', {
            assignmentId,
            submissionId: id,
            error,
        });
    }
    const created = await db.prepare('SELECT * FROM hw_submissions WHERE id=?').bind(id).first<any>();
    return jsonResponse({ status: 'success', data: mapSubmission(created || { id }) }, 201);
}

function normalizeBreakdown(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 100).map((item: any, index) => ({
        questionId: String(item.questionId ?? item.id ?? index + 1),
        label: String(item.label || `Câu ${index + 1}`).slice(0, 160),
        score: Math.max(0, Number(item.score || 0)),
        maxScore: Math.max(0.01, Number(item.maxScore || 1)),
        comment: String(item.comment || '').slice(0, 1000),
    }));
}

async function callHomeworkAi(env: Env, media: string | string[], prompt: string): Promise<any> {
    const target = String(env.CLIPROXY_API || '').replace(/\/$/, '');
    if (!target || !env.CLIPROXY_TOKEN) throw new Error('AI service not configured');
    let lastError: unknown = new Error('AI service unavailable');
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45_000);
        try {
            const response = await fetch(`${target}/chat/completions`, {
                method: 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CLIPROXY_TOKEN}` },
                body: JSON.stringify({
                    model: 'gemini-2.0-flash', response_format: { type: 'json_object' },
                    messages: [{ role: 'user', content: [
                        { type: 'text', text: prompt },
                        ...(Array.isArray(media) ? media : [media]).map(url => ({ type: 'image_url', image_url: { url } })),
                    ] }],
                }),
            });
            if (!response.ok) {
                const error = new Error(`AI service returned ${response.status}`);
                if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
                    lastError = error;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
                throw error;
            }
            const payload: any = await response.json();
            const content = String(payload?.choices?.[0]?.message?.content || '').replace(/^```json\s*|\s*```$/g, '');
            return JSON.parse(content);
        } catch (error) {
            lastError = error;
            if (attempt === 1 || (error instanceof DOMException && error.name === 'AbortError')) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError;
}

async function performOcr(env: Env, user: JWTPayload, body: Record<string, any>): Promise<Response> {
    if (!requireTeacher(user)) return errorResponse('Forbidden', 403);
    const urls = validateMediaUrls([body.mediaUrl]);
    if (!urls) return errorResponse('Invalid media URL', 400);
    try {
        const result = await callHomeworkAi(env, urls[0], 'Trích xuất chính xác nội dung đề bài. Trả JSON {"ocrText":"..."}.');
        return jsonResponse({ status: 'success', data: { ocrText: String(result.ocrText || '').slice(0, 50_000) } });
    } catch (error) {
        console.error('[Homework OCR]', error);
        return errorResponse('AI OCR temporarily unavailable', 502);
    }
}

async function suggestGrade(db: D1Database, env: Env, user: JWTPayload, submissionId: string): Promise<Response> {
    const row = await db.prepare(`
      SELECT hs.*, ha.rubric_json, ha.source_ocr_text, ha.ai_content, ha.class_id, c.teacher_username
      FROM hw_submissions hs JOIN hw_assignments ha ON ha.id=hs.assignment_id JOIN classes c ON c.id=ha.class_id
      WHERE hs.id=?
    `).bind(submissionId).first<any>();
    if (!row) return errorResponse('Submission not found', 404);
    if (!teacherOwnsAssignment(user, row)) return errorResponse('Forbidden', 403);
    const urls = validateMediaUrls(parseJson(row.file_urls, []));
    if (!urls) return errorResponse('Submission media is invalid', 400);
    const rubric = parseJson(row.rubric_json, []);
    const prompt = `Bạn là giáo viên. Chấm bài theo thang 10 nhưng chỉ đưa ra đề xuất để giáo viên duyệt.\nĐề/rubric: ${JSON.stringify(rubric.length ? rubric : row.source_ocr_text || row.ai_content || '')}\nTrả JSON: {"score":0,"confidence":0,"feedback":"","criteriaBreakdown":[{"questionId":"1","label":"Câu 1","score":0,"maxScore":1,"comment":""}],"flaggedReason":null}.`;
    try {
        const result = await callHomeworkAi(env, urls, prompt);
        const score = Number(result.score);
        const confidence = Number(result.confidence);
        if (!Number.isFinite(score) || score < 0 || score > 10 || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
            await db.prepare("UPDATE hw_submissions SET status='NEEDS_REVIEW', ai_feedback=? WHERE id=?")
                .bind('Phản hồi AI không hợp lệ; giáo viên cần chấm thủ công.', submissionId).run();
            return errorResponse('AI response failed validation', 422);
        }
        const breakdown = normalizeBreakdown(result.criteriaBreakdown);
        const feedback = String(result.feedback || '').slice(0, 5000);
        await db.prepare(`UPDATE hw_submissions SET status='AI_REVIEW', ai_score=?, ai_confidence=?, ai_feedback=?, ai_evaluation=?, grading_breakdown_json=? WHERE id=?`)
            .bind(score, confidence, feedback, feedback, JSON.stringify(breakdown), submissionId).run();
        return jsonResponse({ status: 'success', data: { score, confidence, feedback, criteriaBreakdown: breakdown, flaggedReason: result.flaggedReason || null } });
    } catch (error) {
        console.error('[Homework AI grading]', error);
        await db.prepare("UPDATE hw_submissions SET status='NEEDS_REVIEW', ai_feedback=? WHERE id=?")
            .bind('Dịch vụ AI tạm thời không khả dụng; giáo viên cần chấm thủ công.', submissionId).run();
        return errorResponse('AI grading temporarily unavailable', 502);
    }
}

async function publishGrade(db: D1Database, user: JWTPayload, submissionId: string, body: Record<string, any>): Promise<Response> {
    const row = await db.prepare(`SELECT hs.*, ha.class_id, ha.title AS assignment_title, ha.subject, c.teacher_username FROM hw_submissions hs JOIN hw_assignments ha ON ha.id=hs.assignment_id JOIN classes c ON c.id=ha.class_id WHERE hs.id=?`)
        .bind(submissionId).first<any>();
    if (!row) return errorResponse('Submission not found', 404);
    if (!teacherOwnsAssignment(user, row)) return errorResponse('Forbidden', 403);
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) return errorResponse('Score must be between 0 and 10', 400);
    const breakdown = normalizeBreakdown(body.gradingBreakdown || body.criteriaBreakdown || parseJson(row.grading_breakdown_json, []));
    const now = new Date().toISOString();
    const feedback = String(body.feedback || body.teacher_feedback || '').slice(0, 5000);
    await db.prepare(`UPDATE hw_submissions SET status='GRADED', score=?, teacher_feedback=?, grading_breakdown_json=?, analytics_json=?, graded_by=?, graded_at=?, published_at=? WHERE id=?`)
        .bind(score, feedback, JSON.stringify(breakdown),
            JSON.stringify(breakdown.map((x: any) => ({ questionId: x.questionId, label: x.label, score: x.score / x.maxScore }))),
            user.username, now, now, submissionId).run();
    try {
        await createNotification(db, {
            userId: String(row.student_id),
            userRole: 'student',
            type: 'homework_graded',
            priority: 'IMPORTANT',
            title: 'Bài tập của em đã được chấm',
            body: `${row.assignment_title || 'Bài tập'}: ${score.toFixed(1)}/10${feedback ? ` · ${feedback.slice(0, 240)}` : ''}`,
            actionUrl: `/student?assignment=${encodeURIComponent(String(row.assignment_id))}`,
            data: {
                assignment_id: String(row.assignment_id),
                submission_id: submissionId,
                score,
            },
            sourceType: 'homework_grade',
            sourceId: submissionId,
            createdAt: now,
        });
    } catch (error) {
        console.error('[NotificationWriter] homework_graded failed', {
            assignmentId: row.assignment_id,
            submissionId,
            error,
        });
    }
    try {
        await createParentNotification(db, {
            studentId: String(row.student_id),
            kind: 'homework_graded',
            sourceType: 'homework_grade',
            sourceId: submissionId,
            title: 'Bài tập đã được chấm',
            body: `${row.assignment_title || 'Bài tập'}: ${score.toFixed(1)}/10${feedback ? ` – ${feedback.slice(0, 240)}` : ''}`,
            payload: {
                assignmentId: String(row.assignment_id),
                submissionId,
                subject: String(row.subject || ''),
                score,
            },
            publishedAt: now,
            createdBy: user.username,
        });
    } catch (error) {
        console.error('[ParentNotification] homework grade notification failed', error);
    }
    return jsonResponse({ status: 'success', data: { id: submissionId, score, publishedAt: now } });
}

async function assignmentAnalytics(db: D1Database, user: JWTPayload, assignmentId: string): Promise<Response> {
    const assignment = await getAssignment(db, assignmentId);
    if (!assignment) return errorResponse('Assignment not found', 404);
    if (!teacherOwnsAssignment(user, assignment)) return errorResponse('Forbidden', 403);
    const totalRow = await db.prepare("SELECT COUNT(*) AS total FROM students WHERE class_id=? AND COALESCE(archived_at, '')='' ").bind(assignment.class_id).first<any>();
    const rows = await db.prepare(`
      WITH latest AS (
        SELECT hs.* FROM hw_submissions hs
        JOIN (SELECT student_id, MAX(attempt_no) AS attempt_no FROM hw_submissions WHERE assignment_id=? GROUP BY student_id) x
          ON x.student_id=hs.student_id AND x.attempt_no=hs.attempt_no
        WHERE hs.assignment_id=?
      ) SELECT * FROM latest
    `).bind(assignmentId, assignmentId).all<any>();
    const latest = rows.results.map(mapSubmission);
    const published = latest.filter((x: any) => x.published_at);
    const scores = published.map((x: any) => Number(x.score)).sort((a, b) => a - b);
    const median = scores.length ? (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.ceil((scores.length - 1) / 2)]) / 2 : 0;
    const criteria = new Map<string, any>();
    for (const submission of published) {
        for (const item of submission.gradingBreakdown || []) {
            const key = String(item.questionId || item.label);
            const ratio = Number(item.score || 0) / Math.max(Number(item.maxScore || 1), 0.01);
            const current = criteria.get(key) || { questionId: key, label: item.label || key, notMet: 0, partial: 0, mastered: 0, total: 0, studentsNeedingHelp: [] };
            current.total++;
            if (ratio < 0.5) { current.notMet++; current.studentsNeedingHelp.push(submission.student_name); }
            else if (ratio < 0.8) current.partial++;
            else current.mastered++;
            criteria.set(key, current);
        }
    }
    const totalStudents = Number(totalRow?.total || 0);
    const submitted = latest.length;
    const onTime = latest.filter((x: any) => Date.parse(x.submitted_at) <= Date.parse(assignment.deadline)).length;
    const criterionStats = [...criteria.values()].sort((a, b) => b.notMet - a.notMet || b.partial - a.partial);
    return jsonResponse({ status: 'success', data: {
        assignmentId, totalStudents, submitted, onTime, late: submitted - onTime, notSubmitted: Math.max(0, totalStudents - submitted),
        graded: published.length, pending: submitted - published.length,
        averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        medianScore: median,
        scoreDistribution: scores.reduce((acc: Record<string, number>, score) => { const bucket = String(Math.floor(score)); acc[bucket] = (acc[bucket] || 0) + 1; return acc; }, {}),
        criteria: criterionStats,
        mostMissed: criterionStats.slice(0, 5),
    } });
}

export async function handleHomeworkRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const auth = await verifyJWTMiddleware(request, env);
    if (auth instanceof Response) return auth;
    const user = auth.user;
    const url = new URL(request.url);
    const assignmentMatch = path.match(/^\/api\/homework\/assignments\/([^/]+)$/);
    const submissionsMatch = path.match(/^\/api\/homework\/assignments\/([^/]+)\/submissions$/);
    const archiveMatch = path.match(/^\/api\/homework\/assignments\/([^/]+)\/archive$/);
    const analyticsMatch = path.match(/^\/api\/homework\/assignments\/([^/]+)\/analytics$/);
    const suggestionMatch = path.match(/^\/api\/homework\/submissions\/([^/]+)\/ai-suggestion$/);
    const gradeMatch = path.match(/^\/api\/homework\/submissions\/([^/]+)\/grade$/);

    if (path === '/api/homework/assignments' && method === 'GET') return listAssignments(env.DB, user, url);
    if (path === '/api/homework/assignments' && method === 'POST') return createAssignment(env.DB, user, await readBody(request));
    if (assignmentMatch && method === 'PATCH') return updateAssignment(env.DB, user, assignmentMatch[1], await readBody(request));
    if (archiveMatch && method === 'POST') return archiveAssignment(env.DB, user, archiveMatch[1]);
    if (submissionsMatch && method === 'GET') return getSubmissions(env.DB, user, submissionsMatch[1]);
    if (submissionsMatch && method === 'POST') return submitHomework(env.DB, user, submissionsMatch[1], await readBody(request));
    if (path === '/api/homework/submissions/mine' && method === 'GET') return getMyLatestSubmissions(env.DB, user);
    if (analyticsMatch && method === 'GET') return assignmentAnalytics(env.DB, user, analyticsMatch[1]);
    if (path === '/api/homework/ocr' && method === 'POST') return performOcr(env, user, await readBody(request));
    if (suggestionMatch && method === 'POST') return suggestGrade(env.DB, env, user, suggestionMatch[1]);
    if (gradeMatch && method === 'PATCH') return publishGrade(env.DB, user, gradeMatch[1], await readBody(request));
    return errorResponse('Homework route not found', 404);
}
