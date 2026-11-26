import type { QuestionAnswerReview } from '../../../../src/domain/quiz-scoring';
import { jsonResponse, errorResponse } from '../../utils/response';
import { parseBody } from '../../utils/helpers';
import { requireAdmin, requireTeacher, isStudent } from '../../middleware/jwtAuth';
import { withD1Retry } from '../../utils/d1';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../../utils/cursorPagination';
import { loadResultDashboardSummary } from '../../services/resultSummaryService';
import {
    QuizGradingServiceError,
    buildStoredResultReviewDetails,
    loadQuizQuestionsForGrading,
    readStoredReviewDetails,
} from '../../services/quizGradingService';
import {
    resolveResultAccessScope,
    resultScopePredicate,
} from '../../services/resultAccess';
import { requireResultAccess } from './resultAccess';
import type { ResultRouteContext } from './context';

export async function handleResultReadRoutes(context: ResultRouteContext): Promise<Response | null> {
    const { request, db, user, path, method } = context;

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
            () => db.prepare(dataQuery).bind(...bindings, limit + 1).all<import('../../types').ResultRow>(),
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

        const result = access.result;
        const rawAnswers = String(result.answers || '{}');
        let parsedAnswers: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(rawAnswers) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsedAnswers = parsed as Record<string, unknown>;
            }
        } catch {
            parsedAnswers = {};
        }
        let reviewDetails: QuestionAnswerReview[] = [];
        const storedReviewDetails = readStoredReviewDetails(parsedAnswers);
        if (storedReviewDetails) {
            reviewDetails = storedReviewDetails;
        } else {
            try {
                const questions = await loadQuizQuestionsForGrading(db, String(result.quiz_id || ''));
                reviewDetails = buildStoredResultReviewDetails(questions, parsedAnswers);
            } catch (error) {
                if (!(error instanceof QuizGradingServiceError)) throw error;
                if (error.code === 'QUIZ_QUESTIONS_NOT_FOUND') {
                    reviewDetails = buildStoredResultReviewDetails([], parsedAnswers);
                }
            }
        }
        return jsonResponse({
            answers: rawAnswers,
            reviewDetails,
            result: {
                id: String(result.id),
                studentId: result.student_id || undefined,
                classId: result.class_id || undefined,
                assignmentId: result.assignment_id || undefined,
                studentName: result.student_name || '',
                studentClass: result.class_name || '',
                quizId: result.quiz_id || '',
                quizTitle: result.quiz_title || '',
                score: Number(result.score ?? 0),
                correctCount: Number(result.correct_count ?? 0),
                totalQuestions: Number(result.total_questions ?? 0),
                timeTaken: Number(result.time_taken ?? 0),
                submittedAt: result.submitted_at || '',
                gradingVersion: result.grading_version || undefined,
                answers: parsedAnswers,
                reviewDetails,
            },
        });
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

    return null;
}
