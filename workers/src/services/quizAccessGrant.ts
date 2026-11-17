import { jwtVerify, SignJWT } from 'jose';

export const QUIZ_ACCESS_ISSUER = 'tohieuquiz-quiz-access';
export const QUIZ_ACCESS_AUDIENCE = 'tohieuquiz-quiz-play';
const QUIZ_ACCESS_PURPOSE = 'quiz_access_grant';
const DEFAULT_GRANT_SECONDS = 15 * 60;
export const QUIZ_ACCESS_GRANT_TOLERANCE_SECONDS = 120;
export const QUIZ_ACCESS_GRANT_MIN_SECONDS = 60;
export const QUIZ_ACCESS_GRANT_MAX_SECONDS = 60 * 60;

export interface QuizAccessGrantClaims {
    iss?: string;
    aud?: string | string[];
    sub?: string;
    quizId: string;
    revision: number;
    assignmentId?: string;
    codeHash?: string;
    purpose: typeof QUIZ_ACCESS_PURPOSE;
    iat?: number;
    exp?: number;
}

interface IssueQuizAccessGrantInput {
    secret: string;
    quizId: string;
    revision: number;
    assignmentId?: string;
    subject?: string;
    accessCode?: string;
    expiresInSeconds?: number;
    now?: Date;
}

interface VerifyQuizAccessGrantInput {
    secret: string;
    quizId: string;
    revision: number;
    assignmentId?: string;
    subject?: string;
    accessCode?: string;
    now?: Date;
}

const grantKey = (secret: string): Uint8Array => new TextEncoder().encode(
    `${secret}\u0000${QUIZ_ACCESS_ISSUER}\u0000v1`,
);

export async function createQuizAccessCodeBinding(accessCode: string, secret: string): Promise<string | null> {
    const normalized = String(accessCode || '').trim().toUpperCase();
    if (!normalized) return null;
    const key = await crypto.subtle.importKey(
        'raw',
        grantKey(`${secret}\u0000code-binding`),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function quizAccessGrantLifetimeSeconds(timeLimitMinutes: number | null | undefined): number {
    const minutes = Number(timeLimitMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_GRANT_SECONDS;
    return Math.max(
        QUIZ_ACCESS_GRANT_MIN_SECONDS,
        Math.min(QUIZ_ACCESS_GRANT_MAX_SECONDS, Math.ceil(minutes * 60) + QUIZ_ACCESS_GRANT_TOLERANCE_SECONDS),
    );
}

export async function issueQuizAccessGrant(input: IssueQuizAccessGrantInput): Promise<{
    grant: string;
    expiresAt: string;
}> {
    const now = input.now ?? new Date();
    const requestedLifetime = Number(input.expiresInSeconds);
    const expiresInSeconds = Number.isFinite(requestedLifetime) && requestedLifetime > 0
        ? Math.max(QUIZ_ACCESS_GRANT_MIN_SECONDS, Math.min(QUIZ_ACCESS_GRANT_MAX_SECONDS, Math.floor(requestedLifetime)))
        : DEFAULT_GRANT_SECONDS;
    const issuedAt = Math.floor(now.getTime() / 1000);
    const expiresAt = new Date((issuedAt + expiresInSeconds) * 1000);
    const codeHash = await createQuizAccessCodeBinding(input.accessCode || '', input.secret);
    const claims: Record<string, unknown> = {
        quizId: input.quizId,
        revision: input.revision,
        purpose: QUIZ_ACCESS_PURPOSE,
        ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
        ...(input.subject ? { sub: input.subject } : {}),
        ...(codeHash ? { codeHash } : {}),
    };
    const grant = await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(QUIZ_ACCESS_ISSUER)
        .setAudience(QUIZ_ACCESS_AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + expiresInSeconds)
        .sign(grantKey(input.secret));
    return { grant, expiresAt: expiresAt.toISOString() };
}

export async function verifyQuizAccessGrant(
    token: string,
    input: VerifyQuizAccessGrantInput,
): Promise<QuizAccessGrantClaims | null> {
    if (!token || !input.quizId || !Number.isSafeInteger(input.revision)) return null;
    try {
        const { payload } = await jwtVerify(token, grantKey(input.secret), {
            algorithms: ['HS256'],
            issuer: QUIZ_ACCESS_ISSUER,
            audience: QUIZ_ACCESS_AUDIENCE,
            currentDate: input.now ?? new Date(),
        });
        const claims = payload as unknown as QuizAccessGrantClaims;
        const expectedCodeHash = await createQuizAccessCodeBinding(input.accessCode || '', input.secret);
        if (claims.purpose !== QUIZ_ACCESS_PURPOSE
            || claims.quizId !== input.quizId
            || claims.revision !== input.revision
            || (claims.assignmentId ?? undefined) !== (input.assignmentId ?? undefined)
            || (claims.codeHash ?? undefined) !== (expectedCodeHash ?? undefined)
            || (claims.sub ?? undefined) !== (input.subject ?? undefined)) {
            return null;
        }
        return claims;
    } catch {
        return null;
    }
}
