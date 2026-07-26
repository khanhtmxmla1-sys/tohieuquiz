import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMathTelemetryPayload,
  reportMathTelemetry,
  resetMathTelemetryDedupeForTests,
} from '../src/services/mathTelemetryService';

describe('mathTelemetryService privacy boundary', () => {
  beforeEach(() => {
    resetMathTelemetryDedupeForTests();
    vi.restoreAllMocks();
  });

  it('returns only approved metadata and strips route query/hash data', () => {
    const payload = buildMathTelemetryPayload({
      quizId: 'quiz-1',
      questionId: 'question-1',
      questionType: 'mcq',
      errorCode: 'mathjax-merror',
      route: '/quiz?studentName=Private#answer',
      mathFormatVersion: 2,
      formula: '$\\frac{private}{answer}$',
      message: 'private error message',
    } as any);

    expect(payload).toEqual({
      quizId: 'quiz-1',
      questionId: 'question-1',
      questionType: 'MCQ',
      errorCode: 'MATHJAX-MERROR',
      route: '/quiz',
      mathFormatVersion: 2,
    });
    expect(payload).not.toHaveProperty('formula');
    expect(payload).not.toHaveProperty('message');
  });

  it('rejects non-path route values instead of transmitting a URL', () => {
    const payload = buildMathTelemetryPayload({
      errorCode: 'TYPESET-FAILED',
      route: 'https://example.test/quiz?token=secret',
    });

    expect(payload.route).toBe('');
  });

  it('deduplicates identical browser events and never includes formula content', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => false),
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));

    const event = {
      quizId: 'quiz-1',
      questionId: 'q-1',
      questionType: 'MCQ',
      errorCode: 'MATHJAX-MERROR',
      route: '/quiz?student=private',
      mathFormatVersion: 2,
      formula: '$private$',
    } as any;

    reportMathTelemetry(event);
    reportMathTelemetry(event);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(init.body)).not.toContain('private');
    expect(JSON.parse(String(init.body))).toEqual({
      quizId: 'quiz-1',
      questionId: 'q-1',
      questionType: 'MCQ',
      errorCode: 'MATHJAX-MERROR',
      route: '/quiz',
      mathFormatVersion: 2,
    });
  });
});
