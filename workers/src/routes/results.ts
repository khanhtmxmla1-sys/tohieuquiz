// Results + Validate API Routes
// GET /api/results - List all results
// POST /api/results - Submit result
// POST /api/validate - Validate answers (anti-cheat)

import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { handleValidateAnswers, parseBody } from '../utils/helpers';
import { JWTPayload } from '../utils/jwt';
import { verifyJWTMiddleware, requireAdmin, requireTeacher, isStudent } from '../middleware/jwtAuth';
import { withD1Retry } from '../utils/d1';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../utils/cursorPagination';
import { createParentNotification } from '../parentPortal/notificationService';
import { loadResultDashboardSummary } from '../services/resultSummaryService';
import {
    QuizGradingServiceError,
    buildAuthoritativeStoredAnswers,
    gradeQuizSubmission,
} from '../services/quizGradingService';
import { handleInterventionRoutes } from './interventions';
import {
    buildResultSkillBreakdownFromData,
    buildWeaknessProfileFromData,
    getQuestionsForQuizIds,
    getRecentResultsForStudentContext,
    getResultById,
} from '../services/weaknessProfile';

const normalizeName = (value: string | null | undefined): string => String(value || '').trim().toLowerCase();

interface ResultAssignmentPolicy {
    id: string;
    quiz_id: string;
    class_id: string;
    class_name: string;
    student_id: string;
    max_attempts: number;
    status: string;
    deadline: string;
}

const loadResultAssignmentPolicy = async (
    db: D1Database,
    input: {
        assignmentId: string;
        quizId: string;
        className: string;
        student: any | null;
    },
): Promise<ResultAssignmentPolicy | null> => {
    const selectColumns = `
        SELECT a.id, a.quiz_id, a.class_id, COALESCE(a.student_id, '') AS student_id,
               a.max_attempts, a.status, a.deadline, c.name AS class_name
        FROM assignments a
        JOIN classes c ON c.id = a.class_id`;

    if (input.assignmentId) {
        return await db.prepare(`${selectColumns} WHERE a.id = ?`)
            .bind(input.assignmentId)
            .first<ResultAssignmentPolicy>();
    }

    const bindings: unknown[] = [input.quizId, normalizeName(input.className), new Date().toISOString()];
    let query = `${selectColumns}
        WHERE a.quiz_id = ?
          AND LOWER(TRIM(c.name)) = ?
          AND UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'
          AND (COALESCE(a.deadline, '') = '' OR a.deadline >= ?)`;

    if (input.student) {
        query += `
          AND (COALESCE(a.student_id, '') = '' OR a.student_id = ?)
        ORDER BY CASE WHEN a.student_id = ? THEN 0 ELSE 1 END,
                 datetime(a.created_at) DESC
        LIMIT 1`;
        bindings.push(input.student.id, input.student.id);
    } else {
        query += ` ORDER BY datetime(a.created_at) DESC LIMIT 1`;
    }

    return await db.prepare(query).bind(...bindings).first<ResultAssignmentPolicy>();
};

const validateResultAssignmentPolicy = (
    assignment: ResultAssignmentPolicy,
    input: { quizId: string; className: string; student: any | null },
): Response | null => {
    if (
        String(assignment.quiz_id) !== String(input.quizId)
        || normalizeName(assignment.class_name) !== normalizeName(input.className)
    ) {
        return errorResponse('Forbidden: Assignment does not match this quiz or class', 403);
    }

    if (input.student && (
        String(assignment.class_id) !== String(input.student.class_id)
        || (String(assignment.student_id || '') && String(assignment.student_id) !== String(input.student.id))
    )) {
        return errorResponse('Forbidden: Assignment is not available to this student', 403);
    }

    const isClosed = String(assignment.status || '').toUpperCase() === 'CLOSED';
    const deadline = Date.parse(String(assignment.deadline || ''));
    if (isClosed || (Number.isFinite(deadline) && deadline < Date.now())) {
        return errorResponse('Assignment is closed or expired', 409);
    }

    return null;
};

export const deriveResultMetricsFromAnswers = (
    answers: unknown,
    submittedTotalQuestions: unknown,
): { score: number; correctCount: number; totalQuestions: number } | null => {
    if (!answers || typeof answers !== 'object') return null;

    const answerEntries = Object.entries(answers as Record<string, unknown>)
        .filter(([key]) => !key.startsWith('_'));
    const totalQuestions = Number(submittedTotalQuestions);
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0 || answerEntries.length !== totalQuestions) {
        return null;
    }

    const everyAnswerIsGraded = answerEntries.every(([, answer]) => (
        !!answer
        && typeof answer === 'object'
        && typeof (answer as { isCorrect?: unknown }).isCorrect === 'boolean'
    ));
    if (!everyAnswerIsGraded) return null;

    const correctCount = answerEntries.reduce((count, [, answer]) => (
        (answer as { isCorrect: boolean }).isCorrect ? count + 1 : count
    ), 0);
    const score = Math.round((correctCount / totalQuestions) * 100) / 10;
    return { score, correctCount, totalQuestions };
};

const getStudentForUser = async (db: D1Database, user: JWTPayload): Promise<any | null> => {
    if (!isStudent(user)) return null;
    return await db.prepare(
        `SELECT students.id, students.username, students.full_name, students.class_id, classes.name AS class_name
         FROM students
         LEFT JOIN classes ON classes.id = students.class_id
         WHERE students.username = ?`
    ).bind(user.username).first<any>();
};

const canTeacherAccessClassName = async (db: D1Database, user: JWTPayload, className: string): Promise<boolean> => {
    if (requireAdmin(user)) return true;
    if (user.role !== 'teacher') return false;
    const classroom = await db.prepare('SELECT id FROM classes WHERE name = ? AND teacher_username = ?')
        .bind(className, user.username)
        .first<any>();
    return !!classroom;
};

const resolveUniqueStudentId = async (
    db: D1Database,
    studentName: string,
    className: string,
): Promise<string | null> => {
    const rows = await db.prepare(`
        SELECT s.id
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE LOWER(TRIM(s.full_name)) = ?
          AND LOWER(TRIM(c.name)) = ?
          AND COALESCE(s.archived_at, '') = ''
        LIMIT 2
    `).bind(normalizeName(studentName), normalizeName(className)).all<{ id: string }>();

    return rows.results.length === 1 ? String(rows.results[0].id) : null;
};

const canAccessResult = async (db: D1Database, user: JWTPayload, result: any): Promise<boolean> => {
    if (requireAdmin(user)) return true;
    if (user.role === 'teacher') {
        return await canTeacherAccessClassName(db, user, result.class_name || '');
    }
    if (isStudent(user)) {
        const student = await getStudentForUser(db, user);
        if (!student) return false;
        return normalizeName(result.student_name) === normalizeName(student.full_name) &&
            normalizeName(result.class_name) === normalizeName(student.class_name);
    }
    return false;
};

const requireResultAccess = async (db: D1Database, user: JWTPayload, resultId: string): Promise<{ result: any } | Response> => {
    const result = await getResultById(db, resultId);
    if (!result) return errorResponse('Result not found', 404);
    if (!(await canAccessResult(db, user, result))) {
        return errorResponse('Forbidden: You do not have access to this result', 403);
    }
    return { result };
};

export async function handleResultRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const db = env.DB;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const interventionResponse = await handleInterventionRoutes({
        request,
        env,
        user,
        path,
        method,
    });
    if (interventionResponse) return interventionResponse;

    if (path === '/api/results/summary' && method === 'GET') {
        if (!requireTeacher(user)) {
            return errorResponse('Forbidden: Teacher access required', 403);
        }

        const scope = requireAdmin(user)
            ? { role: 'admin' as const }
            : { role: 'teacher' as const, username: user.username };
        const summary = await loadResultDashboardSummary(db, scope);
        return jsonResponse({ data: summary });
    }

    // GET /api/results - Stable cursor pagination for large result collections.
    if (path === '/api/results' && method === 'GET') {
        const url = new URL(request.url);
        let limit: number;
        let cursorValues: string[] | null;
        try {
            limit = collectionLimit(url);
            cursorValues = decodeCollectionCursor(url.searchParams.get('cursor'), 'results', 2);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Pagination invalid', 400);
        }
        const quizId = url.searchParams.get('quizId') || '';

        let countQuery = 'SELECT COUNT(*) as total FROM results';
        let dataQuery = 'SELECT id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at FROM results';
        const bindings: unknown[] = [];
        const whereClauses: string[] = [];

        if (quizId) {
            whereClauses.push('quiz_id = ?');
            bindings.push(quizId);
        }

        if (user.role === 'teacher') {
            whereClauses.push('class_name IN (SELECT name FROM classes WHERE teacher_username = ?)');
            bindings.push(user.username);
        } else if (isStudent(user)) {
            const student = await getStudentForUser(db, user);
            if (!student) return errorResponse('Student not found', 404);
            whereClauses.push('LOWER(TRIM(student_name)) = ? AND LOWER(TRIM(class_name)) = ?');
            bindings.push(normalizeName(student.full_name), normalizeName(student.class_name));
        } else if (!requireAdmin(user)) {
            return errorResponse('Forbidden: Results access required', 403);
        }

        const countBindings = [...bindings];
        if (cursorValues) {
            whereClauses.push('(submitted_at < ? OR (submitted_at = ? AND id < ?))');
            bindings.push(cursorValues[0], cursorValues[0], cursorValues[1]);
        }
        if (whereClauses.length > 0) {
            dataQuery += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        const countClauses = whereClauses.filter((clause) => !clause.startsWith('(submitted_at < ?'));
        if (countClauses.length > 0) countQuery += ` WHERE ${countClauses.join(' AND ')}`;
        dataQuery += ' ORDER BY submitted_at DESC, id DESC LIMIT ?';

        const countResult = await withD1Retry(
            () => db.prepare(countQuery).bind(...countBindings).first<{ total: number }>(),
            'GET /api/results count',
        );
        const rows = await withD1Retry(
            () => db.prepare(dataQuery).bind(...bindings, limit + 1).all<import('../types').ResultRow>(),
            'GET /api/results cursor page',
        );
        const sourceRows = rows.results || [];
        const pageRows = sourceRows.slice(0, limit);
        const last = pageRows.at(-1);
        const mapped = pageRows.map((result) => ({
            id: result.id,
            'Student Name': result.student_name,
            'Class': result.class_name,
            'Quiz ID': result.quiz_id,
            'Quiz Title': result.quiz_title,
            'Score': result.score,
            correctCount: result.correct_count,
            'Total Questions': result.total_questions,
            'Time Taken': result.time_taken || 0,
            'Submitted At': result.submitted_at,
        }));
        const hasMore = sourceRows.length > limit;
        return jsonResponse({
            data: mapped,
            meta: {
                limit,
                total: Number(countResult?.total || 0),
                hasMore,
                nextCursor: hasMore && last
                    ? encodeCollectionCursor('results', [last.submitted_at, last.id])
                    : null,
            },
        });
    }

    // GET /api/results/:id/answers - Lazy-load answers for a specific result
    if (path.match(/^\/api\/results\/[^/]+\/answers$/) && method === 'GET') {
        const id = path.split('/')[3];
        const access = await requireResultAccess(db, user, id);
        if (access instanceof Response) return access;

        const row = await db.prepare('SELECT answers FROM results WHERE id = ?').bind(id).first<{ answers: string }>();
        if (!row) return errorResponse('Result not found', 404);
        return jsonResponse({ answers: row.answers });
    }

    // POST /api/results/answers/bulk - Cohort answers for teacher question analysis
    if (path === '/api/results/answers/bulk' && method === 'POST') {
        if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);

        const body = await parseBody(request);
        const rawIds = Array.isArray(body?.resultIds) ? body.resultIds : [];
        const resultIds = Array.from(new Set(
            rawIds
                .filter((id: unknown): id is string | number => typeof id === 'string' || typeof id === 'number')
                .map((id: string | number) => String(id).trim())
                .filter(Boolean)
        ));
        if (resultIds.length === 0 || resultIds.length > 200 || resultIds.length !== rawIds.length) {
            return errorResponse('resultIds must contain 1 to 200 unique result IDs');
        }

        const placeholders = resultIds.map(() => '?').join(',');
        const bindings: unknown[] = [...resultIds];
        let query = `SELECT id, answers FROM results WHERE id IN (${placeholders})`;
        if (!requireAdmin(user)) {
            query += ' AND class_name IN (SELECT name FROM classes WHERE teacher_username = ?)';
            bindings.push(user.username);
        }
        const rows = await db.prepare(query).bind(...bindings).all<{ id: string; answers: string }>();
        const answersByResultId = Object.fromEntries(
            (rows.results || []).map((row) => [String(row.id), row.answers || '{}'])
        );

        return jsonResponse({ data: answersByResultId });
    }

    // GET /api/results/:id/skill-breakdown
    if (path.match(/^\/api\/results\/[^/]+\/skill-breakdown$/) && method === 'GET') {
        const resultId = path.split('/')[3];
        const access = await requireResultAccess(db, user, resultId);
        if (access instanceof Response) return access;
        const { result } = access;

        const questions = await getQuestionsForQuizIds(db, [result.quiz_id]);
        return jsonResponse(buildResultSkillBreakdownFromData(result, questions));
    }

    // GET /api/results/:id/weakness-profile
    if (path.match(/^\/api\/results\/[^/]+\/weakness-profile$/) && method === 'GET') {
        const resultId = path.split('/')[3];
        const access = await requireResultAccess(db, user, resultId);
        if (access instanceof Response) return access;
        const { result } = access;

        const recentResults = await getRecentResultsForStudentContext(db, result);
        const visibleRecentResults: any[] = [];
        for (const item of recentResults) {
            if (await canAccessResult(db, user, item)) visibleRecentResults.push(item);
        }
        const questions = await getQuestionsForQuizIds(db, visibleRecentResults.map((item) => item.quiz_id));
        return jsonResponse(buildWeaknessProfileFromData(result, visibleRecentResults, questions));
    }

    // POST /api/results - Submit result
    if (path === '/api/results' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');

        const quizId = body.quizId || '';
        let studentName = body.studentName || '';
        let className = body.className || '';
        let studentContext: any | null = null;

        if (isStudent(user)) {
            studentContext = await getStudentForUser(db, user);
            if (!studentContext) return errorResponse('Student not found', 404);
            studentName = studentContext.full_name || '';
            className = studentContext.class_name || '';
        } else if (user.role === 'teacher') {
            if (!(await canTeacherAccessClassName(db, user, className))) {
                return errorResponse('Forbidden: You do not manage this class', 403);
            }
        } else if (!requireAdmin(user)) {
            return errorResponse('Forbidden: Results submit access required', 403);
        }

        const canonicalStudentId = studentContext?.id
            || await resolveUniqueStudentId(db, studentName, className);

        // SECURITY CHECK: Enforce the exact assignment selected by the student UI.
        // Older clients without assignmentId fall back only to the newest applicable open assignment.
        const assignmentId = String(body.assignmentId || '').trim();
        const assignment = await loadResultAssignmentPolicy(db, {
            assignmentId,
            quizId,
            className,
            student: studentContext,
        });

        if (assignmentId && !assignment) {
            return errorResponse('Assignment not found', 404);
        }

        if (assignment) {
            const assignmentError = validateResultAssignmentPolicy(assignment, {
                quizId,
                className,
                student: studentContext,
            });
            if (assignmentError) return assignmentError;

            const maxAttempts = Number(assignment.max_attempts) || 1;
            const countResult = await db.prepare(
                `SELECT COUNT(*) as cnt
                 FROM results
                 WHERE assignment_id = ?
                   AND (
                     student_id = ?
                     OR (
                       student_id IS NULL
                       AND LOWER(TRIM(student_name)) = ?
                       AND LOWER(TRIM(class_name)) = ?
                     )
                   )`
            ).bind(
                assignment.id,
                canonicalStudentId,
                normalizeName(studentName),
                normalizeName(className),
            ).first<{ cnt: number }>();

            const currentAttempts = countResult?.cnt || 0;
            if (currentAttempts >= maxAttempts) {
                return errorResponse(`Bạn đã hết lượt làm bài tập này (${currentAttempts}/${maxAttempts}).`, 403);
            }
        }

        let grading;
        try {
            grading = await gradeQuizSubmission(db, quizId, body.answers || {});
        } catch (error) {
            if (error instanceof QuizGradingServiceError) {
                return jsonResponse({
                    status: 'error',
                    code: error.code,
                    message: error.message,
                    details: error.details,
                }, error.status);
            }
            throw error;
        }
        const score = grading.score;
        const correctCount = grading.correctCount;
        const totalQuestions = grading.totalQuestions;
        const authoritativeAnswers = buildAuthoritativeStoredAnswers(
            grading.questions,
            body.answers || {},
            grading.details,
        );
        const submittedAt = new Date().toISOString();
        const insertResult = await db.prepare(`
            INSERT INTO results (
                student_id, assignment_id, student_name, class_name, quiz_id, quiz_title,
                score, correct_count, total_questions, time_taken, submitted_at, answers,
                grading_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            canonicalStudentId, assignment?.id || null, studentName, className, quizId,
            body.quizTitle || '', score, correctCount,
            totalQuestions, body.timeTaken || 0,
            submittedAt,
            JSON.stringify(authoritativeAnswers),
            grading.gradingVersion,
        ).run();
        const resultId = insertResult.meta.last_row_id;
        if (canonicalStudentId) {
            try {
                await createParentNotification(db, {
                    studentId: canonicalStudentId,
                    kind: 'quiz_result',
                    sourceType: 'result',
                    sourceId: String(resultId),
                    title: 'Có kết quả bài kiểm tra mới',
                    body: `${body.quizTitle || 'Bài kiểm tra'}: ${score.toFixed(1)}/10, đúng ${correctCount}/${totalQuestions} câu.`,
                    payload: { resultId: String(resultId), quizId, score, correctCount, totalQuestions },
                    publishedAt: submittedAt,
                });
            } catch (error) {
                console.error('[ParentNotification] quiz result notification failed', error);
            }
        }
        return jsonResponse({
            status: 'success',
            resultId,
            assignmentId: assignment?.id || null,
            score,
            correctCount,
            totalQuestions,
            gradingVersion: grading.gradingVersion,
            answers: authoritativeAnswers,
            validationDetails: grading.details,
        });
    }

    // DELETE /api/results/:id - Delete result
    if (path.match(/^\/api\/results\/[^/]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        if (!id) return errorResponse('Result id is required', 400);
        const access = await requireResultAccess(db, user, id);
        if (access instanceof Response) return access;
        if (!requireAdmin(user) && user.role !== 'teacher') {
            return errorResponse('Forbidden: Teacher or admin access required', 403);
        }

        await db.prepare('DELETE FROM results WHERE id = ?').bind(id).run();
        return jsonResponse({ status: 'success' });
    }

    // POST /api/validate - Validate answers (server-side anti-cheat)
    if (path === '/api/validate' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (!requireTeacher(user) && !isStudent(user)) {
            return errorResponse('Forbidden: Authenticated user required', 403);
        }

        return await handleValidateAnswers(db, body, { includeCorrectAnswers: requireTeacher(user) });
    }

    return errorResponse('Not found: ' + path, 404);
}
