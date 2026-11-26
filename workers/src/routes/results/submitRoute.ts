import { parseBody } from '../../utils/helpers';
import { jsonResponse, errorResponse } from '../../utils/response';
import { requireAdmin, isStudent } from '../../middleware/jwtAuth';
import { createParentNotification } from '../../parentPortal/notificationService';
import { recordQuizActivity } from '../../gameLoop/activityService';
import { normalizeGameLoopCategory } from '../../gameLoop/normalization';
import {
    QuizGradingServiceError,
    attachReviewDetailsWithinBudget,
    buildAuthoritativeReviewDetails,
    buildAuthoritativeStoredAnswers,
    gradeQuizSubmission,
} from '../../services/quizGradingService';
import {
    deriveStudentQuizDtoKey,
    deriveStudentQuizDtoScope,
    hasOpaqueStudentAnswerIds,
} from '../../services/studentQuizQuestionDto';
import {
    isPublicPracticeQuiz,
    isQuizAttachedToProtectedWorkflow,
    resolveQuizPlayAccess,
} from '../../services/quizAccessPolicy';
import { verifyQuizAccessGrant } from '../../services/quizAccessGrant';
import {
    recordScoringShadowObservation,
    resolveQuizScoringRolloutMode,
} from '../../services/quizScoringRolloutService';
import { resolveSubmissionClass, getStudentForUser, resolveUniqueStudentId } from './submissionIdentity';
import { loadResultAssignmentPolicy, validateResultAssignmentPolicy, quizRequiresAccessCode } from './assignmentPolicy';
import type { ResultRouteContext } from './context';

export async function handleResultSubmitRoute(context: ResultRouteContext): Promise<Response | null> {
    const { request, env, db, user, path, method } = context;
    if (path !== '/api/results' || method !== 'POST') return null;

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

        // Staff tooling may still bind a legacy submission to an open
        // assignment. Learners must send the exact assignmentId so a public
        // quiz cannot be used to discover or submit against an assigned copy.
        if (!assignment && !isStudent(user)) {
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

        if (isStudent(user)) {
            const quizAccess = await db.prepare(`
                SELECT id, revision, show_on_home, require_code, access_code, time_limit
                FROM quizzes
                WHERE id = ?
                LIMIT 1
            `).bind(quizId).first<{
                id: string;
                revision?: number | null;
                show_on_home?: string | number | boolean | null;
                require_code?: string | number | boolean | null;
                access_code?: string | null;
                time_limit?: number | null;
            }>();
            if (!quizAccess) return errorResponse('Forbidden: Quiz access required', 403);

            const scopedAssignmentId = assignment?.id || assignmentId || undefined;
            const accessGrant = typeof body.accessGrant === 'string' ? body.accessGrant.trim() : '';
            // Keep grant subject derivation identical to play-questions: the
            // token identity, not a client-provided or DB-resolved display ID,
            // binds the code verification to this student session.
            const subject = String(user.id || user.username || '').trim() || undefined;
            const revision = Number(quizAccess.revision || 1);
            const grantClaims = accessGrant
                ? await verifyQuizAccessGrant(accessGrant, {
                    secret: env.JWT_SECRET,
                    quizId: String(quizId),
                    revision,
                    assignmentId: scopedAssignmentId,
                    subject,
                    accessCode: quizRequiresAccessCode(quizAccess.require_code)
                        ? String(quizAccess.access_code || '')
                        : undefined,
                })
                : null;
            const access = await resolveQuizPlayAccess(db, {
                quizId: String(quizId),
                actor: user,
                assignmentId: scopedAssignmentId,
                accessCodeVerified: Boolean(grantClaims),
                now: new Date(),
            });
            if (!access.allowed) return errorResponse('Forbidden: Quiz access required', 403);
            if (access.kind === 'public') {
                if (await isQuizAttachedToProtectedWorkflow(db, String(quizId))) {
                    return errorResponse('Forbidden: Quiz access required', 403);
                }
                if (!access.requiresCode && !(await isPublicPracticeQuiz(db, String(quizId)))) {
                    return errorResponse('Forbidden: Quiz access required', 403);
                }
            }
            if (grantClaims && grantClaims.revision !== access.revision) {
                return errorResponse('Quiz revision changed; please verify access again', 409);
            }
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

        let assignmentMaxAttempts = 1;
        if (assignment) {
            const maxAttempts = Number(assignment.max_attempts) || 1;
            assignmentMaxAttempts = maxAttempts;
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
        const useStudentDto = user.role === 'student'
            && Boolean(studentContext)
            && hasOpaqueStudentAnswerIds(body.answers || {});
        const quizRevision = useStudentDto
            ? await db.prepare('SELECT revision FROM quizzes WHERE id = ? LIMIT 1')
                .bind(quizId)
                .first<{ revision?: number | null }>()
            : null;
        const studentDtoContext = useStudentDto && studentContext
            ? {
                quizId: String(quizId),
                revision: Number(quizRevision?.revision || 1),
                scope: deriveStudentQuizDtoScope({
                    quizId: String(quizId),
                    actor: {
                        role: user.role,
                        id: String(studentContext.id || user.id || '').trim() || undefined,
                        username: String(studentContext.username || user.username || '').trim() || undefined,
                    },
                    assignmentId: assignment?.id || undefined,
                }),
                key: await deriveStudentQuizDtoKey(env.JWT_SECRET),
            }
            : undefined;
        let grading;
        try {
            grading = await gradeQuizSubmission(db, quizId, body.answers || {}, studentDtoContext);
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
            grading.canonicalAnswers,
            grading.details,
        );
        const reviewDetails = buildAuthoritativeReviewDetails(
            grading.questions,
            grading.canonicalAnswers,
            grading.details,
        );
        const answersWithReview = attachReviewDetailsWithinBudget(authoritativeAnswers, reviewDetails);
        const submittedAt = new Date().toISOString();
        const resultInsertSql = assignment
            ? `
            INSERT INTO results (
                student_id, assignment_id, class_id, student_name, class_name, quiz_id, quiz_title,
                score, correct_count, total_questions, time_taken, submitted_at, answers,
                grading_version
            ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE (
                SELECT COUNT(*)
                FROM results
                WHERE assignment_id = ?
                  AND COALESCE(answers, '') != '{"status":"STARTED"}'
                  AND student_id = ?
            ) < ?
        `
            : `
            INSERT INTO results (
                student_id, assignment_id, class_id, student_name, class_name, quiz_id, quiz_title,
                score, correct_count, total_questions, time_taken, submitted_at, answers,
                grading_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const resultInsertBindings: unknown[] = [
            canonicalStudentId, assignment?.id || null, canonicalClassId, studentName, className, quizId,
            body.quizTitle || '', score, correctCount,
            totalQuestions, body.timeTaken || 0,
            submittedAt,
            JSON.stringify(answersWithReview),
            grading.gradingVersion,
        ];
        if (assignment) {
            resultInsertBindings.push(assignment.id, canonicalStudentId, assignmentMaxAttempts);
        }
        const insertResult = await db.prepare(resultInsertSql).bind(...resultInsertBindings).run();
        const insertChanges = insertResult.meta?.changes;
        if (assignment && (
            insertResult.success !== true
            || typeof insertChanges !== 'number'
            || !Number.isFinite(insertChanges)
            || !Number.isInteger(insertChanges)
            || (insertChanges !== 0 && insertChanges !== 1)
        )) {
            throw new Error('ASSIGNMENT_RESULT_INSERT_FAILED');
        }
        if (assignment && insertChanges === 0) {
            const countResult = await db.prepare(
                `SELECT COUNT(*) as cnt
                 FROM results
                 WHERE assignment_id = ?
                   AND COALESCE(answers, '') != '{"status":"STARTED"}'
                   AND student_id = ?`
            ).bind(assignment.id, canonicalStudentId).first<{ cnt: number }>();
            const currentAttempts = Number(countResult?.cnt || 0);
            return jsonResponse({
                status: 'error',
                code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
                message: `Em đã hết lượt làm bài này (${currentAttempts}/${assignmentMaxAttempts}).`,
                attemptCount: currentAttempts,
                maxAttempts: assignmentMaxAttempts,
            }, 409);
        }
        const resultId = insertResult.meta.last_row_id;
        if (canonicalStudentId) {
            try {
                const progressStudent = studentContext?.username
                    ? studentContext
                    : await db.prepare('SELECT username FROM students WHERE id = ? LIMIT 1')
                        .bind(canonicalStudentId).first<any>();
                if (progressStudent?.username) {
                    const quizProgressMeta = await db.prepare('SELECT category FROM quizzes WHERE id = ? LIMIT 1')
                        .bind(quizId).first<any>();
                    await recordQuizActivity(db, String(progressStudent.username), {
                        activityId: String(resultId),
                        quizId: String(quizId),
                        studentId: String(canonicalStudentId),
                        classId: canonicalClassId,
                        category: normalizeGameLoopCategory(String(quizProgressMeta?.category || '')),
                        correctCount,
                        totalQuestions,
                    });
                }
            } catch (error) {
                console.error('[GameLoop] result progress recording failed; client retry remains available', error);
            }

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
            answers: answersWithReview,
            validationDetails: grading.details,
            reviewDetails,
        });
    }
