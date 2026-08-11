// Results + Validate API Routes
// GET /api/results - List all results
// POST /api/results - Submit result
// POST /api/validate - Validate answers (anti-cheat)

import { Env } from '../types';
import type { QuestionAnswerReview } from '../../../src/domain/quiz-scoring';
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
    buildAuthoritativeReviewDetails,
    buildAuthoritativeStoredAnswers,
    buildStoredResultReviewDetails,
    gradeQuizSubmission,
    loadQuizQuestionsForGrading,
} from '../services/quizGradingService';
import {
    recordScoringShadowObservation,
    resolveQuizScoringRolloutMode,
} from '../services/quizScoringRolloutService';
import { handleInterventionRoutes } from './interventions';
import {
    canAccessCanonicalResult,
    resolveResultAccessScope,
    resultScopePredicate,
    type ResultAccessScope,
} from '../services/resultAccess';
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
        classId: string;
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
    if (!input.classId) return null;

    const bindings: unknown[] = [input.quizId, input.classId, new Date().toISOString()];
    let query = `${selectColumns}
        WHERE a.quiz_id = ?
          AND a.class_id = ?
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
    input: { quizId: string; classId: string; student: any | null },
): Response | null => {
    if (
        String(assignment.quiz_id) !== String(input.quizId)
        || String(assignment.class_id) !== String(input.classId)
    ) {
        return errorResponse('Forbidden: Assignment does not match this quiz or class', 403);
    }

    if (input.student && (
        String(assignment.class_id) !== String(input.student.class_id)
        || (String(assignment.student_id || '') && String(assignment.student_id) !== String(input.student.id))
    )) {
        return errorResponse('Forbidden: Assignment is not available to this student', 403);
    }

    const status = String(assignment.status || '').toUpperCase();
    if (status === 'REVOKED') {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_REVOKED',
            message: 'Bài đã được giáo viên thu hồi.',
        }, 409);
    }
    const isClosed = status === 'CLOSED';
    const deadline = Date.parse(String(assignment.deadline || ''));
    if (isClosed || (Number.isFinite(deadline) && deadline < Date.now())) {
        return errorResponse('Assignment is closed or expired', 409);
    }

    return null;
};

const getStudentForUser = async (db: D1Database, user: JWTPayload): Promise<any | null> => {
    if (!isStudent(user)) return null;
    return await db.prepare(
        `SELECT students.id, students.username, students.full_name, students.class_id, classes.name AS class_name
         FROM students
         LEFT JOIN classes ON classes.id = students.class_id
         WHERE students.username = ? AND COALESCE(students.archived_at, '') = ''`
    ).bind(user.username).first<any>();
};

interface ResultClassRow {
    id: string;
    name: string;
    teacher_username: string;
}

const resultClassError = (
    code: 'RESULT_CLASS_AMBIGUOUS' | 'RESULT_CLASS_FORBIDDEN',
    message: string,
    status: 403 | 409,
): Response => jsonResponse({ status: 'error', code, message }, status);

const resolveSubmissionClass = async (
    db: D1Database,
    user: JWTPayload,
    input: {
        requestedClassId: string;
        className: string;
        student: any | null;
        assignment: ResultAssignmentPolicy | null;
    },
): Promise<ResultClassRow | Response> => {
    const requestedClassId = String(input.requestedClassId || '').trim();
    const requestedClassName = normalizeName(input.className);

    const loadById = async (classId: string): Promise<ResultClassRow | null> => db.prepare(`
        SELECT id, name, teacher_username
        FROM classes
        WHERE id = ? AND COALESCE(archived_at, '') = ''
        LIMIT 1
    `).bind(classId).first<ResultClassRow>();

    const enforceScopeAndName = (classroom: ResultClassRow): Response | null => {
        if (user.role === 'teacher' && classroom.teacher_username !== user.username) {
            return resultClassError('RESULT_CLASS_FORBIDDEN', 'Class is outside your scope', 403);
        }
        if (requestedClassId && requestedClassId !== classroom.id) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'classId conflicts with the canonical result class', 409);
        }
        if (requestedClassName && normalizeName(classroom.name) !== requestedClassName) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'className does not match classId', 409);
        }
        return null;
    };

    if (input.student) {
        const classId = String(input.student.class_id || '').trim();
        if (!classId) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Student has no canonical class', 409);
        }
        if (input.assignment && String(input.assignment.class_id) !== classId) {
            return resultClassError('RESULT_CLASS_FORBIDDEN', 'Assignment is outside the student class', 403);
        }
        const classroom = await loadById(classId);
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Student class could not be resolved', 409);
        }
        return classroom;
    }

    if (input.assignment) {
        const classroom = await loadById(String(input.assignment.class_id || ''));
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Assignment class could not be resolved', 409);
        }
        const error = enforceScopeAndName(classroom);
        return error || classroom;
    }

    if (requestedClassId) {
        const classroom = await loadById(requestedClassId);
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'classId could not be resolved', 409);
        }
        const error = enforceScopeAndName(classroom);
        return error || classroom;
    }

    if (!requestedClassName) {
        return resultClassError('RESULT_CLASS_AMBIGUOUS', 'A canonical class could not be resolved', 409);
    }

    const matches = await db.prepare(`
        SELECT id, name, teacher_username
        FROM classes
        WHERE LOWER(TRIM(name)) = ? AND COALESCE(archived_at, '') = ''
        ORDER BY id
        LIMIT 3
    `).bind(requestedClassName).all<ResultClassRow>();
    const allMatches = matches.results || [];
    const scopedMatches = user.role === 'teacher'
        ? allMatches.filter((row) => row.teacher_username === user.username)
        : allMatches;

    if (user.role === 'teacher' && scopedMatches.length === 0 && allMatches.length > 0) {
        return resultClassError('RESULT_CLASS_FORBIDDEN', 'Class is outside your scope', 403);
    }
    if (scopedMatches.length !== 1) {
        return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Class name is missing or ambiguous', 409);
    }
    return scopedMatches[0];
};

const resolveUniqueStudentId = async (
    db: D1Database,
    studentName: string,
    classId: string,
    requestedStudentId = '',
): Promise<string | null> => {
    if (!classId) return null;
    const requestedId = String(requestedStudentId || '').trim();
    if (requestedId) {
        const row = await db.prepare(`
            SELECT id, full_name
            FROM students
            WHERE id = ? AND class_id = ? AND COALESCE(archived_at, '') = ''
            LIMIT 1
        `).bind(requestedId, classId).first<{ id: string; full_name: string }>();
        if (!row) return null;
        if (normalizeName(studentName) && normalizeName(row.full_name) !== normalizeName(studentName)) return null;
        return String(row.id);
    }
    if (!normalizeName(studentName)) return null;
    const rows = await db.prepare(`
        SELECT s.id
        FROM students s
        WHERE s.class_id = ?
          AND LOWER(TRIM(s.full_name)) = ?
          AND COALESCE(s.archived_at, '') = ''
        LIMIT 2
    `).bind(classId, normalizeName(studentName)).all<{ id: string }>();

    return rows.results.length === 1 ? String(rows.results[0].id) : null;
};

const requireResultAccess = async (
    db: D1Database,
    user: JWTPayload,
    resultId: string,
): Promise<{ result: any; scope: ResultAccessScope } | Response> => {
    const result = await getResultById(db, resultId);
    if (!result) return errorResponse('Result not found', 404);
    const scope = await resolveResultAccessScope(db, user);
    if (!canAccessCanonicalResult(scope, result)) {
        return errorResponse('Forbidden: You do not have access to this result', 403);
    }
    return { result, scope };
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

        const accessScope = await resolveResultAccessScope(db, user);
        const scope = requireAdmin(user)
            ? { role: 'admin' as const }
            : { role: 'teacher' as const, classIds: accessScope.classIds };
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
        let dataQuery = 'SELECT id, student_id, class_id, assignment_id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at, grading_version FROM results';
        const bindings: unknown[] = [];
        const whereClauses: string[] = [];

        if (quizId) {
            whereClauses.push('quiz_id = ?');
            bindings.push(quizId);
        }

        if (!requireAdmin(user) && user.role !== 'teacher' && !isStudent(user)) {
            return errorResponse('Forbidden: Results access required', 403);
        }
        if (!requireAdmin(user)) {
            const accessScope = await resolveResultAccessScope(db, user);
            const predicate = resultScopePredicate(accessScope, 'results');
            whereClauses.push(predicate.sql);
            bindings.push(...predicate.bindings);
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
            studentId: result.student_id || null,
            classId: result.class_id || null,
            assignmentId: result.assignment_id || null,
            'Student Name': result.student_name,
            'Class': result.class_name,
            'Quiz ID': result.quiz_id,
            'Quiz Title': result.quiz_title,
            'Score': result.score,
            correctCount: result.correct_count,
            'Total Questions': result.total_questions,
            'Time Taken': result.time_taken || 0,
            'Submitted At': result.submitted_at,
            gradingVersion: result.grading_version || 'legacy',
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
        let parsedAnswers: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(row.answers || '{}') as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsedAnswers = parsed as Record<string, unknown>;
            }
        } catch {
            parsedAnswers = {};
        }
        let reviewDetails: QuestionAnswerReview[] = [];
        try {
            const questions = await loadQuizQuestionsForGrading(db, String(access.result.quiz_id || ''));
            reviewDetails = buildStoredResultReviewDetails(questions, parsedAnswers);
        } catch (error) {
            if (!(error instanceof QuizGradingServiceError)) throw error;
        }
        return jsonResponse({ answers: row.answers, reviewDetails });
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
            const accessScope = await resolveResultAccessScope(db, user);
            const predicate = resultScopePredicate(accessScope, 'results');
            query += ` AND ${predicate.sql}`;
            bindings.push(...predicate.bindings);
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
        const { result, scope } = access;

        const recentResults = await getRecentResultsForStudentContext(db, result);
        const visibleRecentResults = recentResults.filter((item) => canAccessCanonicalResult(scope, item));
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
        const requestedClassId = String(body.classId || '').trim();
        const requestedStudentId = String(body.studentId || '').trim();
        let studentContext: any | null = null;

        if (isStudent(user)) {
            studentContext = await getStudentForUser(db, user);
            if (!studentContext) return errorResponse('Student not found', 404);
            studentName = studentContext.full_name || '';
            className = studentContext.class_name || '';
        } else if (user.role !== 'teacher' && !requireAdmin(user)) {
            return errorResponse('Forbidden: Results submit access required', 403);
        }

        // Exact assignment IDs are resolved first because assignment.class_id is
        // stronger ownership evidence than any client-provided class label.
        const assignmentId = String(body.assignmentId || '').trim();
        let assignment = assignmentId
            ? await loadResultAssignmentPolicy(db, {
                assignmentId,
                quizId,
                classId: '',
                student: studentContext,
            })
            : null;
        if (assignmentId && !assignment) {
            return errorResponse('Assignment not found', 404);
        }

        const classResolution = await resolveSubmissionClass(db, user, {
            requestedClassId,
            className,
            student: studentContext,
            assignment,
        });
        if (classResolution instanceof Response) return classResolution;
        const canonicalClassId = classResolution.id;
        className = classResolution.name;

        // Legacy clients without assignmentId may still bind to an open assignment,
        // but only inside the already-resolved canonical class.
        if (!assignment) {
            assignment = await loadResultAssignmentPolicy(db, {
                assignmentId: '',
                quizId,
                classId: canonicalClassId,
                student: studentContext,
            });
        }

        if (assignment) {
            const assignmentError = validateResultAssignmentPolicy(assignment, {
                quizId,
                classId: canonicalClassId,
                student: studentContext,
            });
            if (assignmentError) return assignmentError;
        }

        const canonicalStudentId = studentContext?.id
            || await resolveUniqueStudentId(db, studentName, canonicalClassId, requestedStudentId);
        if (!canonicalStudentId) {
            return jsonResponse({
                status: 'error',
                code: 'RESULT_STUDENT_AMBIGUOUS',
                message: 'A canonical student could not be resolved for this result',
            }, 409);
        }

        if (assignment) {
            const maxAttempts = Number(assignment.max_attempts) || 1;
            const countResult = await db.prepare(
                `SELECT COUNT(*) as cnt
                 FROM results
                 WHERE assignment_id = ?
                   AND COALESCE(answers, '') != '{"status":"STARTED"}'
                   AND student_id = ?`
            ).bind(assignment.id, canonicalStudentId).first<{ cnt: number }>();

            const currentAttempts = countResult?.cnt || 0;
            if (currentAttempts >= maxAttempts) {
                return jsonResponse({
                    status: 'error',
                    code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
                    message: `Em đã hết lượt làm bài này (${currentAttempts}/${maxAttempts}).`,
                    attemptCount: currentAttempts,
                    maxAttempts,
                }, 409);
            }
        }

        const scoringMode = await resolveQuizScoringRolloutMode(db, {
            role: user.role as 'admin' | 'teacher' | 'student' | 'parent' | 'public',
            username: user.username,
            classIds: [canonicalClassId],
        });
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
        recordScoringShadowObservation(scoringMode, {
            quizId: String(quizId),
            canonicalScore: grading.score,
            canonicalCorrectCount: grading.correctCount,
            canonicalTotalQuestions: grading.totalQuestions,
            submittedScore: body.score,
            submittedCorrectCount: body.correctCount,
            submittedTotalQuestions: body.totalQuestions,
        });
        const score = grading.score;
        const correctCount = grading.correctCount;
        const totalQuestions = grading.totalQuestions;
        const authoritativeAnswers = buildAuthoritativeStoredAnswers(
            grading.questions,
            body.answers || {},
            grading.details,
        );
        const reviewDetails = buildAuthoritativeReviewDetails(
            grading.questions,
            authoritativeAnswers,
            grading.details,
        );
        const submittedAt = new Date().toISOString();
        const insertResult = await db.prepare(`
            INSERT INTO results (
                student_id, assignment_id, class_id, student_name, class_name, quiz_id, quiz_title,
                score, correct_count, total_questions, time_taken, submitted_at, answers,
                grading_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            canonicalStudentId, assignment?.id || null, canonicalClassId, studentName, className, quizId,
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
            classId: canonicalClassId,
            score,
            correctCount,
            questionCount: grading.questionCount,
            totalQuestions,
            voidedCount: grading.voidedCount,
            gradingVersion: grading.gradingVersion,
            scoringMode,
            answers: authoritativeAnswers,
            validationDetails: grading.details,
            reviewDetails,
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

        return await handleValidateAnswers(db, body, {
            includeCorrectAnswers: requireTeacher(user),
            subject: {
                role: user.role as 'admin' | 'teacher' | 'student' | 'parent' | 'public',
                username: user.username,
                classIds: [],
            },
        });
    }

    return errorResponse('Not found: ' + path, 404);
}
