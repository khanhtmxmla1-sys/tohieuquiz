const CHUNK_RELOAD_MARKER = 'tohieuquiz:stale-chunk-reload-at';
const DEFAULT_COOLDOWN_MS = 60_000;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
];

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface ChunkRecoveryOptions {
  storage?: RecoveryStorage;
  reload?: () => void;
  now?: () => number;
  cooldownMs?: number;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return '';
};

export const isStaleChunkError = (error: unknown): boolean => {
  const message = errorMessage(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

/**
 * Reload once when a browser tab still references hashed assets from an older deployment.
 * The session marker prevents a broken deployment from causing an infinite reload loop.
 */
export const recoverFromStaleChunk = (
  error: unknown,
  options: ChunkRecoveryOptions = {},
): boolean => {
  if (!isStaleChunkError(error)) return false;

  const browserWindow = typeof window === 'undefined' ? null : window;
  const storage = options.storage ?? browserWindow?.sessionStorage;
  const reload = options.reload ?? (() => browserWindow?.location.reload());
  if (!storage || !reload) return false;

  const now = options.now?.() ?? Date.now();
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  try {
    const previousAttempt = Number(storage.getItem(CHUNK_RELOAD_MARKER) || 0);
    if (previousAttempt > 0 && now - previousAttempt < cooldownMs) return false;

    storage.setItem(CHUNK_RELOAD_MARKER, String(now));
    reload();
    return true;
  } catch {
    // When sessionStorage is unavailable, prefer the normal ErrorBoundary UI over a reload loop.
    return false;
  }
};

export const installChunkRecovery = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const onPreloadError = (event: Event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (recoverFromStaleChunk(payload)) event.preventDefault();
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (recoverFromStaleChunk(event.reason)) event.preventDefault();
  };

  window.addEventListener('vite:preloadError', onPreloadError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
};
