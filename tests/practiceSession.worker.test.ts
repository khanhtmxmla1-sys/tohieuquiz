/** @vitest-environment node */

import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signJWT, verifyJWT } from '../workers/src/utils/jwt';
import {
  PRACTICE_DELIVERY_VERSION,
  PRACTICE_MAX_SELECTED_QUESTIONS,
  PRACTICE_MAX_SESSION_TOKEN_BYTES,
  PRACTICE_SESSION_TTL_SECONDS,
  isPracticeGradeRequest,
  isPracticeSessionEnvelope,
} from '../shared/practice-grading.contract';
import {
  derivePracticeDtoContext,
  derivePracticeSessionSigningKey,
  fingerprintPracticeQuestionRow,
  signPracticeSession,
  verifyPracticeSession,
} from '../workers/src/services/practiceSession';

const SECRET = 'worker-practice-secret-that-is-not-the-login-token';
const AUTH_SECRET = 'worker-auth-secret';
const NOW = new Date('2026-11-22T03:00:00.000Z');

const reference = (questionId: string, index = 0) => ({
  questionId,
  quizId: `quiz-${index}`,
  revision: index + 1,
  fingerprint: `${index.toString(16).padStart(2, '0')}${'a'.repeat(62)}`,
});

const sessionInput = (overrides: Record<string, unknown> = {}) => ({
  jwtSecret: SECRET,
  sessionId: 'session-1',
  practiceId: 'practice-1',
  selected: [reference('question-1')],
  now: NOW,
  ...overrides,
});

const decodePayload = (token: string): Record<string, unknown> => {
  const encoded = token.split('.')[1];
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
};

describe('public practice session contract', () => {
  it('signs a bounded, versioned session and verifies it independently of auth JWTs', async () => {
    const envelope = await signPracticeSession(sessionInput());
    const claims = await verifyPracticeSession(envelope.token, { jwtSecret: SECRET, now: NOW });

    expect(envelope.version).toBe(PRACTICE_DELIVERY_VERSION);
    expect(envelope.expiresAt).toBe('2026-11-23T03:00:00.000Z');
    expect(claims).toMatchObject({
      version: PRACTICE_DELIVERY_VERSION,
      sessionId: 'session-1',
      practiceId: 'practice-1',
      selected: [reference('question-1')],
    });

    const authToken = await signJWT({ username: 'student', role: 'student' }, AUTH_SECRET);
    await expect(verifyPracticeSession(authToken, { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();

    const payload = decodePayload(envelope.token);
    expect(payload).not.toHaveProperty('answers');
    expect(payload).not.toHaveProperty('questions');
    expect(JSON.stringify(payload)).not.toContain('correctAnswer');
    expect(Object.keys(payload).sort()).toEqual([
      'aud', 'exp', 'iat', 'iss', 'practiceId', 'purpose', 'selected', 'sessionId', 'version',
    ]);
    expect(Object.keys((payload.selected as Array<Record<string, unknown>>)[0]).sort()).toEqual([
      'fingerprint', 'questionId', 'quizId', 'revision',
    ]);
    await expect(verifyJWT(envelope.token, SECRET)).resolves.toBeNull();
  });

  it('rejects tampering, expiry, missing secrets, wrong purpose, issuer, audience, and algorithm', async () => {
    const envelope = await signPracticeSession(sessionInput());
    const [header, payload, signature] = envelope.token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decodePayload(envelope.token), purpose: 'session' })).toString('base64url');
    await expect(verifyPracticeSession(`${header}.${tamperedPayload}.${signature}`, { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
    await expect(verifyPracticeSession(envelope.token, { jwtSecret: SECRET, now: new Date('2026-11-23T03:00:01.000Z') })).resolves.toBeNull();
    await expect(verifyPracticeSession(envelope.token, { jwtSecret: '', now: NOW })).resolves.toBeNull();

    const key = await derivePracticeSessionSigningKey(SECRET);
    const makeToken = (claims: Record<string, unknown>, protectedHeader: Record<string, string> = { alg: 'HS256', typ: 'JWT' }) => (
      new SignJWT(claims)
        .setProtectedHeader(protectedHeader)
        .setIssuedAt(Math.floor(NOW.getTime() / 1000))
        .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 300)
        .sign(key)
    );
    const baseClaims = {
      version: PRACTICE_DELIVERY_VERSION,
      purpose: 'public-practice-selection',
      sessionId: 'session-1',
      practiceId: 'practice-1',
      selected: [reference('question-1')],
    };

    await expect(verifyPracticeSession(await makeToken({ ...baseClaims, purpose: 'session' }), { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
    await expect(verifyPracticeSession(await makeToken({ ...baseClaims, answer: '2' }), { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
    await expect(verifyPracticeSession(await new SignJWT(baseClaims).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuer('wrong').setAudience('tohieuquiz-public-practice-grading').setIssuedAt(Math.floor(NOW.getTime() / 1000)).setExpirationTime(Math.floor(NOW.getTime() / 1000) + 300).sign(key), { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
    await expect(verifyPracticeSession(await makeToken(baseClaims, { alg: 'HS384', typ: 'JWT' }), { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
  });

  it('enforces strict selection, claim, TTL, and token-size limits', async () => {
    const duplicate = [reference('same'), reference('same', 1)];
    await expect(signPracticeSession(sessionInput({ selected: [{ ...reference('extra'), correctAnswer: '2' }] }))).rejects.toMatchObject({ code: 'PRACTICE_SELECTION_INVALID' });
    await expect(signPracticeSession(sessionInput({ selected: duplicate }))).rejects.toMatchObject({ code: 'PRACTICE_SELECTION_INVALID' });
    await expect(signPracticeSession(sessionInput({ selected: [] }))).rejects.toMatchObject({ code: 'PRACTICE_SELECTION_INVALID' });
    await expect(signPracticeSession(sessionInput({
      selected: Array.from({ length: PRACTICE_MAX_SELECTED_QUESTIONS + 1 }, (_, index) => reference(`question-${index}`, index)),
    }))).rejects.toMatchObject({ code: 'PRACTICE_SELECTION_INVALID' });
    await expect(signPracticeSession(sessionInput({ ttlSeconds: PRACTICE_SESSION_TTL_SECONDS + 1 }))).rejects.toMatchObject({ code: 'PRACTICE_TTL_INVALID' });
    await expect(verifyPracticeSession('x'.repeat(PRACTICE_MAX_SESSION_TOKEN_BYTES + 1), { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();

    const key = await derivePracticeSessionSigningKey(SECRET);
    const malformed = await new SignJWT({
      version: 'unknown-v9',
      purpose: 'public-practice-selection',
      sessionId: 'session-1',
      practiceId: 'practice-1',
      selected: [reference('question-1')],
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('tohieuquiz-public-practice')
      .setAudience('tohieuquiz-public-practice-grading')
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 300)
      .sign(key);
    await expect(verifyPracticeSession(malformed, { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
  });

  it('rejects malformed signed claims, future-issued tokens, overlong TTLs, duplicate IDs, and UTF-8 oversize', async () => {
    const key = await derivePracticeSessionSigningKey(SECRET);
    const now = Math.floor(NOW.getTime() / 1000);
    const makeToken = (claims: Record<string, unknown>, iat = now, exp = now + 300) => (
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer('tohieuquiz-public-practice')
        .setAudience('tohieuquiz-public-practice-grading')
        .setIssuedAt(iat)
        .setExpirationTime(exp)
        .sign(key)
    );
    const makeRawToken = (claims: Record<string, unknown>) => (
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer('tohieuquiz-public-practice')
        .setAudience('tohieuquiz-public-practice-grading')
        .sign(key)
    );
    const baseClaims = {
      version: PRACTICE_DELIVERY_VERSION,
      purpose: 'public-practice-selection',
      sessionId: 'session-1',
      practiceId: 'practice-1',
      selected: [reference('question-1')],
    };

    await expect(verifyPracticeSession(
      await makeToken({ ...baseClaims, selected: [{ ...reference('question-1'), answer: '2' }] }),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();
    await expect(verifyPracticeSession(
      await makeToken({ ...baseClaims, selected: [{ ...reference('question-1'), revision: '1' }] }),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();
    await expect(verifyPracticeSession(
      await makeToken({ ...baseClaims, selected: [reference('question-1'), reference('question-1', 1)] }),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();
    await expect(verifyPracticeSession(
      await makeRawToken({ ...baseClaims, iat: String(now), exp: now + 300 }),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();
    await expect(verifyPracticeSession(
      await makeToken(baseClaims, now + 61, now + 361),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();
    await expect(verifyPracticeSession(
      await makeToken(baseClaims, now, now + PRACTICE_SESSION_TTL_SECONDS + 1),
      { jwtSecret: SECRET, now: NOW },
    )).resolves.toBeNull();

    const oversizedUtf8 = '🚀'.repeat(Math.floor(PRACTICE_MAX_SESSION_TOKEN_BYTES / 4) + 1);
    expect(new TextEncoder().encode(oversizedUtf8).byteLength).toBeGreaterThan(PRACTICE_MAX_SESSION_TOKEN_BYTES);
    await expect(verifyPracticeSession(oversizedUtf8, { jwtSecret: SECRET, now: NOW })).resolves.toBeNull();
  });

  it('rejects blank signing material across session, fingerprint, and DTO-context operations', async () => {
    await expect(signPracticeSession(sessionInput({ jwtSecret: '   ' }))).rejects.toMatchObject({
      code: 'PRACTICE_SECRET_INVALID',
    });
    await expect(fingerprintPracticeQuestionRow({ id: 'q1' }, '\t')).rejects.toMatchObject({
      code: 'PRACTICE_SECRET_INVALID',
    });
    await expect(derivePracticeDtoContext({
      jwtSecret: '', sessionId: 'session-1', quizId: 'quiz-1', revision: 1,
    })).rejects.toMatchObject({ code: 'PRACTICE_SECRET_INVALID' });
    await expect(derivePracticeSessionSigningKey('')).rejects.toMatchObject({
      code: 'PRACTICE_SECRET_INVALID',
    });
  });

  it('keeps shared wire validators bounded and rejects blank or invalid request shapes', () => {
    expect(isPracticeSessionEnvelope({
      version: PRACTICE_DELIVERY_VERSION,
      token: 'session-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })).toBe(true);
    expect(isPracticeGradeRequest({ sessionToken: '', answers: {} })).toBe(false);
    expect(isPracticeGradeRequest({ sessionToken: '   ', answers: {} })).toBe(false);
    expect(isPracticeGradeRequest({ sessionToken: 'session-token', answers: {}, questionOrder: [1] })).toBe(false);
    expect(isPracticeGradeRequest({
      sessionToken: '🚀'.repeat(Math.floor(PRACTICE_MAX_SESSION_TOKEN_BYTES / 4) + 1),
      answers: {},
    })).toBe(false);
  });

  it('uses a keyed domain-separated fingerprint and deterministic per-session DTO context', async () => {
    const row = {
      id: 'question-1',
      quiz_id: 'quiz-1',
      type: 'SHORT_ANSWER',
      question: '1 + 1 = ?',
      correct_answer: '2',
      options: null,
    };
    const reorderedRow = {
      options: null,
      correct_answer: '2',
      question: '1 + 1 = ?',
      type: 'SHORT_ANSWER',
      quiz_id: 'quiz-1',
      id: 'question-1',
    };
    const fingerprint = await fingerprintPracticeQuestionRow(row, SECRET);
    expect(fingerprint).toHaveLength(64);
    await expect(fingerprintPracticeQuestionRow(reorderedRow, SECRET)).resolves.toBe(fingerprint);
    await expect(fingerprintPracticeQuestionRow({ ...row, correct_answer: '3' }, SECRET)).resolves.not.toBe(fingerprint);
    await expect(fingerprintPracticeQuestionRow(row, `${SECRET}-other`)).resolves.not.toBe(fingerprint);

    const first = await derivePracticeDtoContext({ jwtSecret: SECRET, sessionId: 'session-1', quizId: 'quiz-1', revision: 7 });
    const same = await derivePracticeDtoContext({ jwtSecret: SECRET, sessionId: 'session-1', quizId: 'quiz-1', revision: 7 });
    const otherSession = await derivePracticeDtoContext({ jwtSecret: SECRET, sessionId: 'session-2', quizId: 'quiz-1', revision: 7 });
    expect(first).toEqual(same);
    expect(first.scope).not.toBe(otherSession.scope);
    expect(Array.from(first.key as Uint8Array)).not.toEqual(Array.from(otherSession.key as Uint8Array));
  });
});
