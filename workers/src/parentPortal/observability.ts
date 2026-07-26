export interface ParentPortalLogSink {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface ParentPortalEventLogger {
  info(event: string, metadata?: Record<string, unknown>): void;
  warn(event: string, metadata?: Record<string, unknown>): void;
}

const BLOCKED_KEY = /(token|pin|password|accesscode|cookie|authorization|secret)/i;

const safeKey = (key: string): boolean => !BLOCKED_KEY.test(key.replace(/[^a-z0-9]/gi, ''));

export const sanitizeParentPortalLogMetadata = (
  value: unknown,
  depth = 0,
): unknown => {
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeParentPortalLogMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') return value.slice(0, 240);
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!safeKey(key)) continue;
    output[key] = sanitizeParentPortalLogMetadata(item, depth + 1);
  }
  return output;
};

export const createParentPortalEventLogger = (
  sink: ParentPortalLogSink = console,
): ParentPortalEventLogger => ({
  info(event, metadata = {}) {
    sink.info(`[ParentPortal] ${event}`, sanitizeParentPortalLogMetadata(metadata) as Record<string, unknown>);
  },
  warn(event, metadata = {}) {
    sink.warn(`[ParentPortal] ${event}`, sanitizeParentPortalLogMetadata(metadata) as Record<string, unknown>);
  },
});

export const parentPortalLogger = createParentPortalEventLogger();
