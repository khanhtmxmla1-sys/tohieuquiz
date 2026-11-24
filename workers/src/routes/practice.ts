import {
    PRACTICE_DELIVERY_VERSION,
    PRACTICE_MAX_GRADE_BODY_BYTES,
    isPlainRecord,
    isPracticeGradeRequest,
} from '../../../shared/practice-grading.contract';
import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { rateLimit } from '../middleware/rateLimit';
import { loadRandomizationPolicy } from '../services/randomizationPolicyService';
import {
    extractPracticeTags,
    normalizePracticeTopic,
    parsePracticeLimit,
    PUBLIC_PRACTICE_SOURCE_SCOPE_SQL,
} from '../services/practiceQuestionScope';
import {
    loadPracticeSelection,
    mapPracticeSourceRow,
    PracticeGradingError,
    gradePracticeSubmission,
} from '../services/practiceGrading';
import {
    derivePracticeDtoContext,
    fingerprintPracticeQuestionRow,
    signPracticeSession,
} from '../services/practiceSession';
import { toPracticeQuestionDto } from '../services/practicePresentation';

const noStoreJson = <T>(data: T, status = 200): Response => {
    const response = jsonResponse(data, status);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
};

const noStoreResponse = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
};

const practiceError = (code: string, message: string, status: number): Response => noStoreJson({
    status: 'error',
    code,
    message,
}, status);

const parseGradeBody = async (request: Request): Promise<Record<string, unknown> | null> => {
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > PRACTICE_MAX_GRADE_BODY_BYTES) return null;
    const body = request.body;
    if (!body) return null;
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;
            totalBytes += value.byteLength;
            if (totalBytes > PRACTICE_MAX_GRADE_BODY_BYTES) {
                await reader.cancel();
                return null;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        return isPlainRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export async function handlePracticeRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const db = env.DB;

    // GET /api/practice/topics - List all unique topics from the public pool.
    if (path === '/api/practice/topics' && method === 'GET') {
        try {
            const rows = await db.prepare(`
                SELECT q.tags
                ${PUBLIC_PRACTICE_SOURCE_SCOPE_SQL}
                  AND q.tags IS NOT NULL
                  AND q.tags != ''
            `).all<{ tags: string }>();

            const topicMap = new Map<string, number>();
            rows.results.forEach((row: any) => {
                if (!row.tags) return;
                const uniqueTagsInQuestion = new Set(extractPracticeTags(row.tags));
                uniqueTagsInQuestion.forEach((tag) => topicMap.set(tag, (topicMap.get(tag) || 0) + 1));
            });

            const uniqueTopics = Array.from(topicMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return jsonResponse({ topics: uniqueTopics }, 200, 60);
        } catch (error: any) {
            console.error('[GET /api/practice/topics] Error:', error.message);
            return errorResponse('Failed to fetch practice topics');
        }
    }

    if (path === '/api/practice/grade' && method === 'POST') {
        // Public practice is guest-facing and commonly used from one shared
        // classroom egress IP. Keep abuse protection while allowing normal
        // classrooms to submit a full set of short sessions per minute.
        const rateLimitResponse = await rateLimit(request, env, {
            windowMs: 60 * 1000,
            maxRequests: 120,
            failureMode: 'closed',
        });
        if (rateLimitResponse) return noStoreResponse(rateLimitResponse);

        const body = await parseGradeBody(request);
        if (!body || !isPracticeGradeRequest(body)) {
            return practiceError('PRACTICE_REQUEST_INVALID', 'Practice grade request is invalid.', 400);
        }
        try {
            const result = await gradePracticeSubmission({
                db,
                jwtSecret: env.JWT_SECRET,
                sessionToken: body.sessionToken,
                answers: body.answers,
                questionOrder: body.questionOrder,
            });
            return noStoreJson(result);
        } catch (error) {
            if (error instanceof PracticeGradingError) {
                return practiceError(error.code, error.message, error.status);
            }
            console.error('[POST /api/practice/grade] Error:', error instanceof Error ? error.message : 'unknown');
            return practiceError('PRACTICE_GRADING_UNAVAILABLE', 'Practice grading is temporarily unavailable.', 503);
        }
    }

    // Secure practice is versioned. An old browser must refresh before it can
    // receive any question payload; the legacy route never runs here.
    if (path === '/api/practice' && method === 'GET') {
        const url = new URL(request.url);
        if (url.searchParams.get('delivery') !== PRACTICE_DELIVERY_VERSION) {
            return practiceError(
                'PRACTICE_CLIENT_REFRESH_REQUIRED',
                'This practice client must refresh before starting a secure practice session.',
                409,
            );
        }

        try {
            const topic = normalizePracticeTopic(url.searchParams.get('topic'));
            const limit = parsePracticeLimit(url.searchParams.get('limit'));
            if (!topic) return practiceError('PRACTICE_TOPIC_INVALID', 'Missing or invalid topic parameter.', 400);
            if (limit === null) return practiceError('PRACTICE_LIMIT_INVALID', 'Invalid limit parameter.', 400);

            const randomizationPolicy = await loadRandomizationPolicy(db);
            const sourceRows = await loadPracticeSelection({
                db,
                topic,
                limit,
                randomize: randomizationPolicy.randomizePracticeSelection,
            });
            if (sourceRows.length === 0) {
                return practiceError('PRACTICE_NO_QUESTIONS', 'No practice questions are available for this topic.', 404);
            }

            const practiceId = `practice_${crypto.randomUUID()}`;
            const sessionId = crypto.randomUUID();
            const selected = await Promise.all(sourceRows.map(async (row) => ({
                questionId: String(row.id ?? ''),
                quizId: String(row.quiz_id ?? ''),
                revision: Number(row.quiz_revision ?? 1),
                fingerprint: await fingerprintPracticeQuestionRow(row, env.JWT_SECRET),
            })));
            if (selected.some((reference) => !reference.questionId || !reference.quizId
                || !Number.isSafeInteger(reference.revision) || reference.revision < 0)) {
                return practiceError('PRACTICE_QUESTION_INVALID', 'Practice questions are temporarily unavailable.', 503);
            }

            const practiceSession = await signPracticeSession({
                jwtSecret: env.JWT_SECRET,
                sessionId,
                practiceId,
                selected,
            });
            const questions = await Promise.all(sourceRows.map(async (row) => {
                const sourceQuestion = mapPracticeSourceRow(row);
                const context = await derivePracticeDtoContext({
                    jwtSecret: env.JWT_SECRET,
                    sessionId,
                    quizId: String(row.quiz_id ?? ''),
                    revision: Number(row.quiz_revision ?? 1),
                });
                const dto = await toPracticeQuestionDto(sourceQuestion, context);
                return {
                    ...dto,
                    quizId: String(row.quiz_id ?? ''),
                };
            }));

            const virtualQuiz = {
                id: practiceId,
                title: `Ôn tập: ${topic.replace('#', '').replace(/_/g, ' ')}`,
                classLevel: 'Tự do',
                category: 'Luyện tập',
                timeLimit: 0,
                isPractice: true,
                createdAt: new Date().toISOString(),
                practiceSession,
                questions,
            };
            return noStoreJson(virtualQuiz);
        } catch (error) {
            console.error('[GET /api/practice] Error:', error instanceof Error ? error.message : 'unknown');
            return practiceError('PRACTICE_UNAVAILABLE', 'Practice questions are temporarily unavailable.', 503);
        }
    }

    return errorResponse('Not found: ' + path, 404);
}
