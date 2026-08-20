import { serializeLiveExamAnswers } from './liveExamAnswerDraft';

export type LiveExamAnswerMap = Record<string, unknown>;
export type LiveExamSyncStatus = 'local-saved' | 'local-error' | 'syncing' | 'synced' | 'offline' | 'sync-error';

export interface LiveExamAutosaveSnapshot {
  attemptVersion: number;
  answers: LiveExamAnswerMap;
  updatedAt: string;
}

export interface LiveExamAutosavePayload {
  attemptVersion: number;
  idempotencyKey: string;
  answers: LiveExamAnswerMap;
}

interface CreateLiveExamAutosaveQueueOptions {
  sessionId: string;
  initialAnswers: LiveExamAnswerMap;
  initialOnline: boolean;
  getSnapshot: (sessionId: string) => Promise<LiveExamAutosaveSnapshot | null>;
  saveSnapshot: (
    sessionId: string,
    payload: LiveExamAutosavePayload,
  ) => Promise<LiveExamAutosaveSnapshot>;
  onStatus: (status: LiveExamSyncStatus) => void;
  onRemoteAnswers?: (answers: LiveExamAnswerMap) => void;
  createId?: () => string;
  remoteDebounceMs?: number;
}

export interface LiveExamAutosaveQueue {
  enqueue: (answers: LiveExamAnswerMap) => void;
  setOnline: (online: boolean) => void;
  retry: () => void;
  dispose: () => void;
}

const cloneAnswers = (answers: LiveExamAnswerMap): LiveExamAnswerMap => (
  JSON.parse(serializeLiveExamAnswers(answers)) as LiveExamAnswerMap
);

const fingerprint = (answers: LiveExamAnswerMap): string => serializeLiveExamAnswers(answers);
const hasAnswers = (answers: LiveExamAnswerMap): boolean => Object.keys(answers).length > 0;

const errorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  const value = Number((error as { status?: unknown }).status);
  return Number.isFinite(value) ? value : null;
};

export const createLiveExamAutosaveQueue = ({
  sessionId,
  initialAnswers,
  initialOnline,
  getSnapshot,
  saveSnapshot,
  onStatus,
  onRemoteAnswers,
  createId = () => crypto.randomUUID(),
  remoteDebounceMs = 1_750,
}: CreateLiveExamAutosaveQueueOptions): LiveExamAutosaveQueue => {
  let latestAnswers = cloneAnswers(initialAnswers);
  let pendingAnswers: LiveExamAnswerMap | null = hasAnswers(latestAnswers)
    ? cloneAnswers(latestAnswers)
    : null;
  let serverVersion = 0;
  let lastSyncedFingerprint: string | null = null;
  let online = initialOnline;
  let initialized = false;
  let initializing: Promise<void> | null = null;
  let reinitializeRequested = false;
  let inFlight = false;
  let disposed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (status: LiveExamSyncStatus) => {
    if (!disposed) onStatus(status);
  };

  const flush = async (): Promise<void> => {
    if (disposed || !online || !initialized || inFlight || !pendingAnswers) return;

    const outgoing = pendingAnswers;
    pendingAnswers = null;
    const outgoingFingerprint = fingerprint(outgoing);
    if (outgoingFingerprint === lastSyncedFingerprint) {
      emit('synced');
      return;
    }

    const attemptVersion = serverVersion + 1;
    serverVersion = attemptVersion;
    inFlight = true;
    emit('syncing');

    try {
      const saved = await saveSnapshot(sessionId, {
        attemptVersion,
        idempotencyKey: `autosave:${sessionId}:${attemptVersion}:${createId()}`,
        answers: outgoing,
      });
      if (disposed) return;
      serverVersion = Math.max(serverVersion, saved.attemptVersion);
      lastSyncedFingerprint = outgoingFingerprint;
      inFlight = false;

      if (!online) {
        emit('offline');
      } else if (pendingAnswers) {
        scheduleFlush();
      } else {
        emit('synced');
      }
    } catch (error) {
      if (disposed) return;
      inFlight = false;
      pendingAnswers = cloneAnswers(latestAnswers);
      if (!online) {
        emit('offline');
        return;
      }
      if (errorStatus(error) === 409) {
        initialized = false;
        reinitializeRequested = true;
        if (!initializing) {
          reinitializeRequested = false;
          void initialize();
        }
        return;
      }
      emit('sync-error');
    }
  };

  const clearScheduledFlush = () => {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
  };

  const scheduleFlush = () => {
    clearScheduledFlush();
    if (disposed || !online || !initialized || !pendingAnswers) return;
    if (remoteDebounceMs <= 0) {
      void flush();
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, remoteDebounceMs);
  };

  const initialize = async (): Promise<void> => {
    if (disposed || !online || initialized) {
      if (initialized) scheduleFlush();
      return;
    }
    if (initializing) {
      await initializing;
      return;
    }

    emit('syncing');
    initializing = (async () => {
      try {
        const serverSnapshot = await getSnapshot(sessionId);
        if (disposed || !online) return;

        serverVersion = serverSnapshot?.attemptVersion ?? 0;
        initialized = true;
        const localFingerprint = fingerprint(latestAnswers);

        if (serverSnapshot) {
          const remoteAnswers = cloneAnswers(serverSnapshot.answers);
          const remoteFingerprint = fingerprint(remoteAnswers);
          if (!hasAnswers(latestAnswers) && pendingAnswers === null) {
            latestAnswers = remoteAnswers;
            lastSyncedFingerprint = remoteFingerprint;
            onRemoteAnswers?.(cloneAnswers(remoteAnswers));
            emit('synced');
            return;
          }
          if (remoteFingerprint === localFingerprint) {
            lastSyncedFingerprint = localFingerprint;
            pendingAnswers = null;
            emit('synced');
            return;
          }
        }

        if (!pendingAnswers && hasAnswers(latestAnswers)) {
          pendingAnswers = cloneAnswers(latestAnswers);
        }
        if (pendingAnswers) scheduleFlush();
        else emit('synced');
      } catch {
        if (!disposed && online) {
          initialized = false;
          emit('sync-error');
        }
      } finally {
        initializing = null;
        if (reinitializeRequested && !disposed && online) {
          reinitializeRequested = false;
          void initialize();
        }
      }
    })();

    await initializing;
  };

  const enqueue = (answers: LiveExamAnswerMap) => {
    if (disposed) return;
    latestAnswers = cloneAnswers(answers);
    pendingAnswers = cloneAnswers(answers);
    if (!online) {
      emit('offline');
      return;
    }
    if (!initialized) void initialize();
    else scheduleFlush();
  };

  const setOnline = (nextOnline: boolean) => {
    if (disposed || online === nextOnline) return;
    online = nextOnline;
    if (!online) {
      clearScheduledFlush();
      initialized = false;
      emit('offline');
      return;
    }
    void initialize();
  };

  const retry = () => {
    if (disposed || !online) return;
    if (!initialized) void initialize();
    else {
      clearScheduledFlush();
      void flush();
    }
  };

  if (online) void initialize();
  else emit('offline');

  return {
    enqueue,
    setOnline,
    retry,
    dispose: () => {
      disposed = true;
      clearScheduledFlush();
      pendingAnswers = null;
    },
  };
};
