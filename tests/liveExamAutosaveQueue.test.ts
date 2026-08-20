import { describe, expect, it, vi } from 'vitest';
import {
  createLiveExamAutosaveQueue,
  type LiveExamAutosaveSnapshot,
  type LiveExamSyncStatus,
} from '../src/features/live-exam/liveExamAutosaveQueue';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const snapshot = (attemptVersion: number, answers: Record<string, unknown>): LiveExamAutosaveSnapshot => ({
  attemptVersion,
  answers,
  updatedAt: '2026-08-04T05:00:00.000Z',
});

describe('liveExamAutosaveQueue', () => {
  it('debounces remote writes for 1.75s and coalesces rapid edits to the newest answers', async () => {
    vi.useFakeTimers();
    const saveSnapshot = vi.fn(async (_sessionId, payload) => snapshot(payload.attemptVersion, payload.answers));
    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-debounce',
      initialAnswers: {},
      initialOnline: true,
      getSnapshot: vi.fn(async () => null),
      saveSnapshot,
      onStatus: vi.fn(),
      createId: () => 'debounce-id',
    });
    await settle();

    queue.enqueue({ q1: 'A' });
    queue.enqueue({ q1: 'B' });
    queue.enqueue({ q1: 'C' });
    await settle();
    expect(saveSnapshot).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_749);
    expect(saveSnapshot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(saveSnapshot.mock.calls[0][1]).toMatchObject({ answers: { q1: 'C' } });
    queue.dispose();
    vi.useRealTimers();
  });
  it('keeps one request in flight and coalesces pending edits to the newest answers', async () => {
    const first = deferred<LiveExamAutosaveSnapshot>();
    const saveSnapshot = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(async (_sessionId, payload) => snapshot(payload.attemptVersion, payload.answers));
    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-1',
      initialAnswers: {},
      initialOnline: true,
      getSnapshot: vi.fn(async () => null),
      saveSnapshot,
      onStatus: vi.fn(),
      createId: () => 'id',
      remoteDebounceMs: 0,
    });
    await settle();

    queue.enqueue({ q1: 'A' });
    await settle();
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(saveSnapshot.mock.calls[0][1]).toMatchObject({ attemptVersion: 1, answers: { q1: 'A' } });

    queue.enqueue({ q1: 'B' });
    queue.enqueue({ q1: 'C' });
    await settle();
    expect(saveSnapshot).toHaveBeenCalledTimes(1);

    first.resolve(snapshot(1, { q1: 'A' }));
    await settle();
    expect(saveSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot.mock.calls[1][1]).toMatchObject({ attemptVersion: 2, answers: { q1: 'C' } });
    queue.dispose();
  });

  it('rebases on the server version after a stale-version conflict', async () => {
    const conflict = Object.assign(new Error('Stale answer snapshot version'), { status: 409 });
    const getSnapshot = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(snapshot(5, { q1: 'SERVER' }));
    const saveSnapshot = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (_sessionId, payload) => snapshot(payload.attemptVersion, payload.answers));
    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-1',
      initialAnswers: {},
      initialOnline: true,
      getSnapshot,
      saveSnapshot,
      onStatus: vi.fn(),
      createId: () => 'id',
      remoteDebounceMs: 0,
    });
    await settle();

    queue.enqueue({ q1: 'LOCAL' });
    await settle();
    await settle();

    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot.mock.calls[1][1]).toMatchObject({ attemptVersion: 6, answers: { q1: 'LOCAL' } });
    queue.dispose();
  });

  it('rebases a bootstrapping local draft without waiting on its own initialization', async () => {
    const conflict = Object.assign(new Error('Stale answer snapshot version'), { status: 409 });
    const getSnapshot = vi.fn()
      .mockResolvedValueOnce(snapshot(2, { q1: 'OLD' }))
      .mockResolvedValueOnce(snapshot(3, { q1: 'NEWER_SERVER' }));
    const saveSnapshot = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (_sessionId, payload) => snapshot(payload.attemptVersion, payload.answers));

    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-1',
      initialAnswers: { q1: 'LOCAL_DRAFT' },
      initialOnline: true,
      getSnapshot,
      saveSnapshot,
      onStatus: vi.fn(),
      createId: () => 'id',
      remoteDebounceMs: 0,
    });
    await settle();
    await settle();
    await settle();

    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot.mock.calls[1][1]).toMatchObject({
      attemptVersion: 4,
      answers: { q1: 'LOCAL_DRAFT' },
    });
    queue.dispose();
  });

  it('hydrates a server snapshot only when no local answer exists', async () => {
    const onRemoteAnswers = vi.fn();
    const saveSnapshot = vi.fn();
    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-1',
      initialAnswers: {},
      initialOnline: true,
      getSnapshot: vi.fn(async () => snapshot(3, { q1: 'B' })),
      saveSnapshot,
      onStatus: vi.fn(),
      onRemoteAnswers,
      createId: () => 'id',
      remoteDebounceMs: 0,
    });
    await settle();

    expect(onRemoteAnswers).toHaveBeenCalledWith({ q1: 'B' });
    expect(saveSnapshot).not.toHaveBeenCalled();
    queue.dispose();
  });

  it('keeps local answers offline and synchronizes after reconnect', async () => {
    const statuses: LiveExamSyncStatus[] = [];
    const saveSnapshot = vi.fn(async (_sessionId, payload) => snapshot(payload.attemptVersion, payload.answers));
    const queue = createLiveExamAutosaveQueue({
      sessionId: 'session-1',
      initialAnswers: {},
      initialOnline: false,
      getSnapshot: vi.fn(async () => null),
      saveSnapshot,
      onStatus: (status) => statuses.push(status),
      createId: () => 'id',
      remoteDebounceMs: 0,
    });

    queue.enqueue({ q1: 'A' });
    await settle();
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe('offline');

    queue.setOnline(true);
    await settle();
    await settle();
    expect(saveSnapshot).toHaveBeenCalledWith('session-1', expect.objectContaining({
      attemptVersion: 1,
      answers: { q1: 'A' },
    }));
    expect(statuses.at(-1)).toBe('synced');
    queue.dispose();
  });
});
