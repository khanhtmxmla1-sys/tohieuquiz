import { Env } from '../../types';
import { jsonResponse } from '../../utils/response';
import { parseBody } from '../../utils/helpers';
import { withD1Retry } from '../../utils/d1';
import { resolveQuizPlayAccess } from '../../services/quizAccessPolicy';
import {
    issueQuizAccessGrant,
    quizAccessGrantLifetimeSeconds,
    verifyQuizAccessGrant,
} from '../../services/quizAccessGrant';
import {
    deriveStudentQuizDtoKey,
    deriveStudentQuizDtoScope,
    toStudentQuestionDto,
} from '../../services/studentQuizQuestionDto';
import { constantTimeTextEqual, isEnabledFlag, quizAccessCodeSchema } from './accessHelpers';
import { optionalAuthUser, privateErrorResponse, privateJsonResponse } from './response';

export async function handleAccessVerificationRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    const accessVerificationMatch = path.match(/^\/api\/quizzes\/access-verification\/([^/]+)$/);
    if (!accessVerificationMatch || method !== 'POST') return null;

    let quizId = '';
    try {
        quizId = decodeURIComponent(accessVerificationMatch[1]).trim();
    } catch {
        return jsonResponse({
            status: 'error',
            code: 'INVALID_ACCESS_CODE_FORMAT',
            message: 'Mã làm bài chưa đúng định dạng.',
        }, 400);
    }

    const body = await parseBody(request);
    const parsed = quizAccessCodeSchema.safeParse(body);
    if (!quizId || !parsed.success) {
        return jsonResponse({
            status: 'error',
            code: 'INVALID_ACCESS_CODE_FORMAT',
            message: 'Mã làm bài chưa đúng định dạng.',
        }, 400);
    }

    const optionalAuth = await optionalAuthUser(request, env);
    if (optionalAuth.failure) return optionalAuth.failure;
    const user = optionalAuth.user;
    const quiz = await env.DB.prepare(
        'SELECT id, access_code, require_code, show_on_home, revision, time_limit FROM quizzes WHERE id = ?',
    ).bind(quizId).first<{
        id?: string;
        access_code?: string | null;
        require_code?: string | number | boolean | null;
        show_on_home?: string | number | boolean | null;
        revision?: number | null;
        time_limit?: number | null;
    }>();

    if (!quiz) {
        return jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
    }
    const assignmentId = parsed.data.assignmentId;
    if (!isEnabledFlag(quiz.require_code)) {
        const decision = await resolveQuizPlayAccess(env.DB, {
            quizId,
            actor: user,
            assignmentId,
            now: new Date(),
        });
        return decision.allowed
            ? jsonResponse({ valid: true })
            : jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
    }

    const actualCode = parsed.data.accessCode.toUpperCase();
    const expectedCode = String(quiz.access_code ?? '').trim().toUpperCase();
    if (!expectedCode || !constantTimeTextEqual(actualCode, expectedCode)) {
        return jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
    }
    const decision = await resolveQuizPlayAccess(env.DB, {
        quizId,
        actor: user,
        assignmentId,
        accessCodeVerified: true,
        now: new Date(),
    });
    if (!decision.allowed) return jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
    const subject = user?.role === 'student' ? (user.id || user.username) : undefined;
    const grant = await issueQuizAccessGrant({
        secret: env.JWT_SECRET,
        quizId,
        revision: Number(quiz.revision || decision.revision || 1),
        assignmentId,
        subject,
        accessCode: expectedCode,
        expiresInSeconds: quizAccessGrantLifetimeSeconds(quiz.time_limit),
    });
    return privateJsonResponse({ valid: true, ...grant });
}

export async function handlePlayQuestionsRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    const playQuestionsMatch = path.match(/^\/api\/quizzes\/([^/]+)\/play-questions$/);
    if (!playQuestionsMatch || method !== 'POST') return null;

    let quizId = '';
    try {
        quizId = decodeURIComponent(playQuestionsMatch[1]).trim();
    } catch {
        return privateErrorResponse('Invalid quiz ID', 400);
    }
    if (!quizId) return privateErrorResponse('Invalid quiz ID', 400);

    const optionalAuth = await optionalAuthUser(request, env);
    if (optionalAuth.failure) return optionalAuth.failure;
    const user = optionalAuth.user;
    const body = await parseBody(request);
    const assignmentId = typeof body?.assignmentId === 'string' && body.assignmentId.trim()
        ? body.assignmentId.trim()
        : undefined;
    const accessGrant = typeof body?.accessGrant === 'string' ? body.accessGrant.trim() : '';
    const quiz = await env.DB.prepare('SELECT revision, access_code, require_code FROM quizzes WHERE id = ?')
        .bind(quizId).first<{ revision?: number | null; access_code?: string | null; require_code?: string | number | boolean | null }>();
    if (!quiz) return privateErrorResponse('Forbidden: Quiz access required', 403);
    const revision = Number(quiz.revision || 1);
    const subject = user?.role === 'student' ? (user.id || user.username) : undefined;
    const grantClaims = accessGrant
        ? await verifyQuizAccessGrant(accessGrant, {
            secret: env.JWT_SECRET,
            quizId,
            revision,
            assignmentId,
            subject,
            accessCode: isEnabledFlag(quiz.require_code) ? String(quiz.access_code || '') : undefined,
        })
        : null;
    const decision = await resolveQuizPlayAccess(env.DB, {
        quizId,
        actor: user,
        assignmentId,
        accessCodeVerified: Boolean(grantClaims),
        now: new Date(),
    });
    if (!decision.allowed) return privateErrorResponse('Forbidden: Quiz access required', 403);
    if (grantClaims && grantClaims.revision !== decision.revision) {
        return privateErrorResponse('Quiz revision changed; please verify access again', 409);
    }
    const latestQuiz = await env.DB.prepare('SELECT revision FROM quizzes WHERE id = ?')
        .bind(quizId).first<{ revision?: number | null }>();
    if (Number(latestQuiz?.revision || 1) !== decision.revision) {
        return privateErrorResponse('Quiz revision changed; please retry', 409);
    }

    const rows = await withD1Retry(
        () => env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC').bind(quizId).all<any>(),
        'POST /api/quizzes play-questions',
    );
    const canonicalStudent = user?.role === 'student'
        ? await env.DB.prepare(`
            SELECT id, username
            FROM students
            WHERE username = ? AND COALESCE(archived_at, '') = ''
            LIMIT 1
        `).bind(user.username).first<{ id?: string; username?: string }>()
        : null;
    const dtoActor = user?.role === 'student'
        ? { ...user, id: canonicalStudent?.id || user.id }
        : user;
    const dtoContext = {
        quizId,
        revision: decision.revision,
        scope: deriveStudentQuizDtoScope({ quizId, actor: dtoActor, assignmentId }),
        key: await deriveStudentQuizDtoKey(env.JWT_SECRET),
    };
    const studentQuestions = await Promise.all(rows.results.map((question) => toStudentQuestionDto(question, dtoContext)));
    return privateJsonResponse({
        quizId,
        revision: decision.revision,
        questions: studentQuestions,
    });
}
