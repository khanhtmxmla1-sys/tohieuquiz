import { describe, expect, it } from 'vitest';
import {
  clearLiveExamAnswerDraft,
  createLiveExamSubmissionAttempt,
  loadLiveExamAnswerDraft,
  saveLiveExamAnswerDraft,
} from '../src/features/live-exam/liveExamAnswerDraft';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('Live Exam answer draft', () => {
  it('round-trips answers in session storage and clears only after success', () => {
    const storage = new MemoryStorage();
    saveLiveExamAnswerDraft('session-1', { q2: 'B', q1: 'A' }, storage);
    expect(loadLiveExamAnswerDraft('session-1', storage)).toEqual({ q1: 'A', q2: 'B' });

    clearLiveExamAnswerDraft('session-1', storage);
    expect(loadLiveExamAnswerDraft('session-1', storage)).toEqual({});
  });

  it('reuses the request key for an unchanged answer snapshot', () => {
    const first = createLiveExamSubmissionAttempt('session-1', { q2: 'B', q1: 'A' });
    const replay = createLiveExamSubmissionAttempt('session-1', { q1: 'A', q2: 'B' }, first);
    const changed = createLiveExamSubmissionAttempt('session-1', { q1: 'C', q2: 'B' }, first);

    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
    expect(replay.answerFingerprint).toBe(first.answerFingerprint);
    expect(changed.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('rejects corrupt or oversized stored drafts', () => {
    const storage = new MemoryStorage();
    storage.setItem('tohieuquiz_live_exam_answers_v1:bad', '{oops');
    expect(loadLiveExamAnswerDraft('bad', storage)).toEqual({});

    const huge = Object.fromEntries(Array.from({ length: 2_000 }, (_, index) => [`q-${index}`, 'x'.repeat(100)]));
    expect(() => saveLiveExamAnswerDraft('huge', huge, storage)).toThrow(/too large/i);
  });
});
